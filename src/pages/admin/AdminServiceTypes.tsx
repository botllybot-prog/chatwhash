import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit, Loader2, Plus, Search, Tags, Trash2 } from "lucide-react";
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

type ServiceType = {
  id: string;
  name: string;
};

const texts: Record<AppLanguage, Record<string, string>> = {
  ar: {
    title: "أنواع الخدمات",
    subtitle: "أنشئ أنواعاً لتصنيف الخدمات بدلاً من مدتها الزمنية.",
    add: "إضافة نوع",
    search: "ابحث باسم النوع...",
    name: "اسم النوع",
    id: "المعرف",
    actions: "إجراءات",
    edit: "تعديل",
    delete: "حذف",
    noRows: "لا توجد أنواع خدمات حالياً.",
    noMatches: "لا توجد نتائج مطابقة.",
    count: "العدد",
    addTitle: "إضافة نوع خدمة",
    editTitle: "تعديل نوع الخدمة",
    formDesc: "اختر اسماً يصف تصنيف هذه الخدمة.",
    namePlaceholder: "مثال: غسيل خارجي",
    cancel: "إلغاء",
    save: "حفظ",
    update: "تحديث",
    required: "اسم النوع مطلوب",
    saveError: "تعذر حفظ نوع الخدمة",
    deleteError: "تعذر حذف نوع الخدمة",
    loadError: "تعذر تحميل أنواع الخدمات",
    added: "تمت إضافة النوع",
    updated: "تم تحديث النوع",
    deleted: "تم حذف النوع",
    confirmTitle: "حذف نوع الخدمة؟",
    confirmBody: "الخدمات المرتبطة بهذا النوع تبقى دون نوع بعد الحذف.",
    confirmDelete: "حذف",
  },
  en: {
    title: "Service types",
    subtitle: "Create types to categorize services instead of tracking their duration.",
    add: "Add type",
    search: "Search by type name...",
    name: "Type name",
    id: "ID",
    actions: "Actions",
    edit: "Edit",
    delete: "Delete",
    noRows: "No service types yet.",
    noMatches: "No matching results.",
    count: "Count",
    addTitle: "Add service type",
    editTitle: "Edit service type",
    formDesc: "Pick a name that describes this category of service.",
    namePlaceholder: "e.g. Exterior wash",
    cancel: "Cancel",
    save: "Save",
    update: "Update",
    required: "Type name is required",
    saveError: "Could not save the service type",
    deleteError: "Could not delete the service type",
    loadError: "Could not load service types",
    added: "Type added",
    updated: "Type updated",
    deleted: "Type deleted",
    confirmTitle: "Delete this service type?",
    confirmBody: "Services using this type will be left without a type.",
    confirmDelete: "Delete",
  },
  ku: {
    title: "جۆرەکانی خزمەتگوزاری",
    subtitle: "جۆر دروست بکە بۆ پۆلێنکردنی خزمەتگوزارییەکان لەبری کاتی ماوەیان.",
    add: "زیادکردنی جۆر",
    search: "گەڕان بە ناوی جۆر...",
    name: "ناوی جۆر",
    id: "ناسنامە",
    actions: "کردارەکان",
    edit: "دەستکاری",
    delete: "سڕینەوە",
    noRows: "هێشتا هیچ جۆرێکی خزمەتگوزاری نییە.",
    noMatches: "هیچ ئەنجامێک نەدۆزرایەوە.",
    count: "ژمارە",
    addTitle: "زیادکردنی جۆری خزمەتگوزاری",
    editTitle: "دەستکاری جۆری خزمەتگوزاری",
    formDesc: "ناوێک هەڵبژێرە کە ئەم پۆلی خزمەتگوزاریی پیشان دەدەت.",
    namePlaceholder: "نموونە: شوشتنی دەرەکی",
    cancel: "پاشگەزبوونەوە",
    save: "پاشەکەوتکردن",
    update: "نوێکردنەوە",
    required: "ناوی جۆر پێویستە",
    saveError: "پاشەکەوتکردنی جۆری خزمەتگوزاری سەرکەوتوو نەبوو",
    deleteError: "سڕینەوەی جۆری خزمەتگوزاری سەرکەوتوو نەبوو",
    loadError: "بارکردنی جۆرەکانی خزمەتگوزاری سەرکەوتوو نەبوو",
    added: "جۆرەکە زیادکرا",
    updated: "جۆرەکە نوێکرایەوە",
    deleted: "جۆرەکە سڕایەوە",
    confirmTitle: "ئەم جۆرە بسڕدرێتەوە؟",
    confirmBody: "خزمەتگوزاری پەیوەستەکان بەم جۆرەوە بێ جۆر دەمێننەوە دوای سڕینەوە.",
    confirmDelete: "سڕینەوە",
  },
  tr: {
    title: "Hizmet türleri",
    subtitle: "Hizmetleri sürelerine göre değil, türlerine göre kategorize edin.",
    add: "Tür ekle",
    search: "Tür adına göre ara...",
    name: "Tür adı",
    id: "Kimlik",
    actions: "İşlemler",
    edit: "Düzenle",
    delete: "Sil",
    noRows: "Henüz hizmet türü yok.",
    noMatches: "Eşleşen sonuç yok.",
    count: "Sayı",
    addTitle: "Hizmet türü ekle",
    editTitle: "Hizmet türünü düzenle",
    formDesc: "Bu hizmet kategorisini tanımlayan bir ad seçin.",
    namePlaceholder: "örn. Dış yıkama",
    cancel: "İptal",
    save: "Kaydet",
    update: "Güncelle",
    required: "Tür adı gerekli",
    saveError: "Hizmet türü kaydedilemedi",
    deleteError: "Hizmet türü silinemedi",
    loadError: "Hizmet türleri yüklenemedi",
    added: "Tür eklendi",
    updated: "Tür güncellendi",
    deleted: "Tür silindi",
    confirmTitle: "Bu hizmet türü silinsin mi?",
    confirmBody: "Bu türü kullanan hizmetler türsüz kalacak.",
    confirmDelete: "Sil",
  },
};

const AdminServiceTypes = () => {
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];

  const [rows, setRows] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceType | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ServiceType | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("service_types")
      .select("id, name")
      .order("name", { ascending: true });
    setLoading(false);

    if (error) {
      toast({ title: t.loadError, description: error.message, variant: "destructive" });
      return;
    }

    setRows((data || []) as ServiceType[]);
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
    setDialogOpen(true);
  };

  const openEdit = (row: ServiceType) => {
    setEditing(row);
    setName(row.name);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditing(null);
    setName("");
  };

  const handleSave = async () => {
    const cleanedName = name.trim();
    if (!cleanedName) {
      toast({ title: t.required, variant: "destructive" });
      return;
    }

    setSaving(true);
    const query = editing
      ? (supabase as any).from("service_types").update({ name: cleanedName }).eq("id", editing.id)
      : (supabase as any).from("service_types").insert({ name: cleanedName });

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
    const { error } = await (supabase as any).from("service_types").delete().eq("id", targetId);
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
            <Tags className="h-5 w-5 text-primary" />
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
                  <TableHead className="hidden md:table-cell">{t.id}</TableHead>
                  <TableHead className="w-32 text-center">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Skeleton className="h-5 w-48" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Skeleton className="h-5 w-72" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="mx-auto h-8 w-24" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      {rows.length === 0 ? t.noRows : t.noMatches}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
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
              <Label htmlFor="service-type-name">{t.name}</Label>
              <Input
                id="service-type-name"
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

export default AdminServiceTypes;
