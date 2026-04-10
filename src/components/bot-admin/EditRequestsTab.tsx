import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Check, X } from "lucide-react";

const EditRequestsTab = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("edit_requests")
      .select("*, stations(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setRequests(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (req: any, action: "approved" | "rejected") => {
    // Update edit_request status
    const { error } = await supabase
      .from("edit_requests")
      .update({
        status: action,
        admin_note: adminNotes[req.id] || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", req.id);

    if (error) {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
      return;
    }

    // If approved, apply the change to the stations table
    if (action === "approved") {
      await supabase
        .from("stations")
        .update({ [req.field_name]: req.new_value })
        .eq("id", req.station_id);
    }

    // Notify the owner
    await supabase.from("notifications").insert({
      user_id: req.requested_by,
      title: action === "approved" ? "تم قبول طلب التعديل ✅" : "تم رفض طلب التعديل ❌",
      body: `طلب تعديل "${fieldLabels[req.field_name] || req.field_name}" ${action === "approved" ? "تم قبوله وتطبيقه" : "تم رفضه"}${adminNotes[req.id] ? " - " + adminNotes[req.id] : ""}`,
      type: "edit_request",
      reference_id: req.id,
    });

    toast({ title: action === "approved" ? "تم القبول والتطبيق" : "تم الرفض" });
    await load();
  };

  const fieldLabels: Record<string, string> = {
    name: "اسم المحطة", address: "العنوان", detailed_address: "العنوان التفصيلي",
    working_hours_start: "بداية العمل", working_hours_end: "نهاية العمل",
    scheduling_type: "نوع المواعيد", image_url: "الصورة",
  };

  const statusLabels: Record<string, string> = { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };
  const statusColors: Record<string, "default" | "secondary" | "destructive"> = { pending: "secondary", approved: "default", rejected: "destructive" };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">طلبات التعديل</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>المحطة</TableHead><TableHead>الحقل</TableHead><TableHead>القيمة القديمة</TableHead>
            <TableHead>القيمة الجديدة</TableHead><TableHead>الحالة</TableHead><TableHead>ملاحظة</TableHead><TableHead>إجراءات</TableHead>
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
                    placeholder="ملاحظة..."
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
          {requests.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد طلبات</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};

export default EditRequestsTab;
