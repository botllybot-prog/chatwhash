import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Check, X } from "lucide-react";
import { useAppLanguage } from "@/lib/language";

const texts = {
  ar: {
    title: "طلبات التعديل",
    station: "المحطة",
    field: "الحقل",
    oldValue: "القيمة القديمة",
    newValue: "القيمة الجديدة",
    status: "الحالة",
    note: "ملاحظة",
    actions: "إجراءات",
    placeholder: "ملاحظة...",
    noRequests: "لا توجد طلبات",
    genericError: "حدث خطأ",
    approvedTitle: "تم القبول والتطبيق",
    rejectedTitle: "تم الرفض",
    sentApproved: "تم قبول طلب التعديل ✅",
    sentRejected: "تم رفض طلب التعديل ❌",
    bodyApproved: "تم قبوله وتطبيقه",
    bodyRejected: "تم رفضه",
    pending: "قيد المراجعة",
    approved: "مقبول",
    rejected: "مرفوض",
    name: "اسم المحطة",
    address: "العنوان",
    detailedAddress: "العنوان التفصيلي",
    workingStart: "بداية العمل",
    workingEnd: "نهاية العمل",
    scheduling: "نوع المواعيد",
    image: "الصورة",
  },
  en: {
    title: "Edit requests",
    station: "Station",
    field: "Field",
    oldValue: "Old value",
    newValue: "New value",
    status: "Status",
    note: "Note",
    actions: "Actions",
    placeholder: "Add a note...",
    noRequests: "No requests found",
    genericError: "Something went wrong",
    approvedTitle: "Approved and applied",
    rejectedTitle: "Rejected",
    sentApproved: "Edit request approved ✅",
    sentRejected: "Edit request rejected ❌",
    bodyApproved: "was approved and applied",
    bodyRejected: "was rejected",
    pending: "Pending review",
    approved: "Approved",
    rejected: "Rejected",
    name: "Station name",
    address: "Address",
    detailedAddress: "Detailed address",
    workingStart: "Working hours start",
    workingEnd: "Working hours end",
    scheduling: "Scheduling type",
    image: "Image",
  },
  ku: {
    title: "داواکارییەکانی دەستکاری",
    station: "وێستگە",
    field: "خانە",
    oldValue: "بەهای کۆن",
    newValue: "بەهای نوێ",
    status: "دۆخ",
    note: "تێبینی",
    actions: "کردارەکان",
    placeholder: "تێبینی...",
    noRequests: "هیچ داواکارییەک نییە",
    genericError: "هەڵەیەک ڕوویدا",
    approvedTitle: "پەسەند کرا و جێبەجێ کرا",
    rejectedTitle: "ڕەت کرایەوە",
    sentApproved: "داواکاریی دەستکاری پەسەند کرا ✅",
    sentRejected: "داواکاریی دەستکاری ڕەت کرایەوە ❌",
    bodyApproved: "پەسەند کرا و جێبەجێ کرا",
    bodyRejected: "ڕەت کرایەوە",
    pending: "لە چاوپێکەوتندایە",
    approved: "پەسەندکراو",
    rejected: "ڕەتکراو",
    name: "ناوی وێستگە",
    address: "ناونیشان",
    detailedAddress: "ناونیشانی ورد",
    workingStart: "دەستی کار",
    workingEnd: "کۆتایی کار",
    scheduling: "جۆری کاتبەندی",
    image: "وێنە",
  },
  tr: {
    title: "Düzenleme talepleri",
    station: "İstasyon",
    field: "Alan",
    oldValue: "Eski değer",
    newValue: "Yeni değer",
    status: "Durum",
    note: "Not",
    actions: "İşlemler",
    placeholder: "Not...",
    noRequests: "Talep yok",
    genericError: "Bir hata oluştu",
    approvedTitle: "Onaylandı ve uygulandı",
    rejectedTitle: "Reddedildi",
    sentApproved: "Düzenleme talebi onaylandı ✅",
    sentRejected: "Düzenleme talebi reddedildi ❌",
    bodyApproved: "onaylandı ve uygulandı",
    bodyRejected: "reddedildi",
    pending: "İncelemede",
    approved: "Onaylandı",
    rejected: "Reddedildi",
    name: "İstasyon adı",
    address: "Adres",
    detailedAddress: "Detaylı adres",
    workingStart: "Çalışma başlangıcı",
    workingEnd: "Çalışma bitişi",
    scheduling: "Randevu tipi",
    image: "Görsel",
  },
} as const;

const EditRequestsTab = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];

  const fieldLabels: Record<string, string> = {
    name: t.name,
    address: t.address,
    detailed_address: t.detailedAddress,
    working_hours_start: t.workingStart,
    working_hours_end: t.workingEnd,
    scheduling_type: t.scheduling,
    image_url: t.image,
  };

  const statusLabels: Record<string, string> = {
    pending: t.pending,
    approved: t.approved,
    rejected: t.rejected,
  };

  const statusColors: Record<string, "default" | "secondary" | "destructive"> = {
    pending: "secondary",
    approved: "default",
    rejected: "destructive",
  };

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("edit_requests")
      .select("*, stations(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setRequests(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (req: any, action: "approved" | "rejected") => {
    const { error } = await supabase
      .from("edit_requests")
      .update({
        status: action,
        admin_note: adminNotes[req.id] || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", req.id);

    if (error) {
      toast({ title: t.genericError, description: error.message, variant: "destructive" });
      return;
    }

    if (action === "approved") {
      await supabase.from("stations").update({ [req.field_name]: req.new_value }).eq("id", req.station_id);
    }

    await supabase.from("notifications").insert({
      user_id: req.requested_by,
      title: action === "approved" ? t.sentApproved : t.sentRejected,
      body: `"${fieldLabels[req.field_name] || req.field_name}" ${action === "approved" ? t.bodyApproved : t.bodyRejected}${adminNotes[req.id] ? " - " + adminNotes[req.id] : ""}`,
      type: "edit_request",
      reference_id: req.id,
    });

    toast({ title: action === "approved" ? t.approvedTitle : t.rejectedTitle });
    await load();
  };

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <h3 className="text-lg font-semibold text-foreground">{t.title}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.station}</TableHead>
            <TableHead>{t.field}</TableHead>
            <TableHead>{t.oldValue}</TableHead>
            <TableHead>{t.newValue}</TableHead>
            <TableHead>{t.status}</TableHead>
            <TableHead>{t.note}</TableHead>
            <TableHead>{t.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{(r as any).stations?.name || "-"}</TableCell>
              <TableCell>{fieldLabels[r.field_name] || r.field_name}</TableCell>
              <TableCell className="text-muted-foreground text-sm max-w-[120px] truncate">{r.old_value || "-"}</TableCell>
              <TableCell className="text-sm max-w-[120px] truncate">{r.new_value}</TableCell>
              <TableCell><Badge variant={statusColors[r.status]}>{statusLabels[r.status]}</Badge></TableCell>
              <TableCell>
                {r.status === "pending" ? (
                  <Input
                    className="w-28 h-8 text-xs"
                    placeholder={t.placeholder}
                    value={adminNotes[r.id] || ""}
                    onChange={(e) => setAdminNotes({ ...adminNotes, [r.id]: e.target.value })}
                  />
                ) : (
                  <span className="text-sm">{r.admin_note || "-"}</span>
                )}
              </TableCell>
              <TableCell>
                {r.status === "pending" && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAction(r, "approved")}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAction(r, "rejected")}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
          {requests.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t.noRequests}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default EditRequestsTab;
