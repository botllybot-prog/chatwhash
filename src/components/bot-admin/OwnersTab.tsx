import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Pencil, Trash2, EyeOff, Eye } from "lucide-react";

type Owner = {
  id: string;
  user_id: string;
  owner_name: string;
  owner_phone: string | null;
  station_id: string;
  is_active: boolean;
  outstanding_debt: number;
  created_at: string;
  stations: { name: string } | null;
};

const emptyForm = { email: "", password: "", owner_name: "", owner_phone: "", station_id: "" };

const OwnersTab = () => {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Owner | null>(null);
  const [editForm, setEditForm] = useState({ owner_name: "", owner_phone: "", station_id: "", outstanding_debt: "" });

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Owner | null>(null);

  const load = useCallback(async () => {
    const [{ data: ow }, { data: st }] = await Promise.all([
      supabase.from("station_owners").select("*, stations(name)").order("created_at", { ascending: false }),
      supabase.from("stations").select("id, name").order("name"),
    ]);
    if (ow) setOwners(ow as Owner[]);
    if (st) setStations(st);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Create ──────────────────────────────────────────────
  const handleCreate = async () => {
    if (!createForm.email || !createForm.password || !createForm.owner_name || !createForm.station_id) {
      toast({ title: "جميع الحقول مطلوبة", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("create-station-owner", {
      body: {
        email: createForm.email,
        password: createForm.password,
        owner_name: createForm.owner_name,
        owner_phone: createForm.owner_phone,
        station_id: createForm.station_id,
      },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: "فشل إنشاء الحساب", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم إنشاء الحساب بنجاح ✅" });
    setCreateOpen(false);
    setCreateForm(emptyForm);
    load();
  };

  // ── Edit ─────────────────────────────────────────────────
  const openEdit = (o: Owner) => {
    setEditTarget(o);
    setEditForm({ owner_name: o.owner_name, owner_phone: o.owner_phone || "", station_id: o.station_id, outstanding_debt: String(o.outstanding_debt ?? 0) });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!editForm.owner_name || !editForm.station_id) {
      toast({ title: "اسم المالك والمحطة مطلوبان", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("station_owners")
      .update({ owner_name: editForm.owner_name, owner_phone: editForm.owner_phone || null, station_id: editForm.station_id, outstanding_debt: parseFloat(editForm.outstanding_debt) || 0 })
      .eq("id", editTarget.id);
    setLoading(false);
    if (error) {
      toast({ title: "فشل التعديل", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم التعديل بنجاح ✅" });
    setEditOpen(false);
    setEditTarget(null);
    load();
  };

  // ── Delete ───────────────────────────────────────────────
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
    toast({ title: "تم حذف الحساب بالكامل 🗑️" });
    setDeleteTarget(null);
    load();
  };

  // ── Toggle active ────────────────────────────────────────
  const handleToggleActive = async (o: Owner) => {
    const newActive = !o.is_active;
    const { error } = await supabase
      .from("station_owners")
      .update({ is_active: newActive })
      .eq("id", o.id);
    if (error) {
      toast({ title: "فشل تغيير الحالة", description: error.message, variant: "destructive" });
      return;
    }
    // When suspending an active owner, push WhatsApp suspension notice
    if (!newActive && o.owner_phone) {
      await supabase.functions.invoke("send-suspension-notice", {
        body: { owner_id: o.id },
      });
    }
    toast({ title: newActive ? "تم تفعيل الحساب ✅" : "تم إيقاف الحساب مؤقتاً ⚠️" });
    load();
  };

  return (
    <div className="space-y-6 p-1" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">أصحاب المحطات</h2>
          <p className="text-sm text-muted-foreground mt-0.5">إدارة حسابات أصحاب المحطات وصلاحياتهم</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 ml-2" />إنشاء حساب جديد</Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg">إنشاء حساب صاحب محطة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5"><Label>اسم المالك *</Label><Input value={createForm.owner_name} onChange={(e) => setCreateForm({ ...createForm, owner_name: e.target.value })} placeholder="أحمد محمد" /></div>
              <div className="space-y-1.5"><Label>البريد الإلكتروني *</Label><Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="owner@example.com" /></div>
              <div className="space-y-1.5"><Label>كلمة المرور *</Label><Input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="8 أحرف على الأقل" /></div>
              <div className="space-y-1.5"><Label>رقم الواتساب</Label><Input value={createForm.owner_phone} onChange={(e) => setCreateForm({ ...createForm, owner_phone: e.target.value })} placeholder="964XXXXXXXXX" /></div>
              <div className="space-y-1.5">
                <Label>المحطة *</Label>
                <Select value={createForm.station_id} onValueChange={(v) => setCreateForm({ ...createForm, station_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر المحطة" /></SelectTrigger>
                  <SelectContent>{stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button>
              <Button onClick={handleCreate} disabled={loading}>{loading ? "جاري الإنشاء..." : "إنشاء الحساب"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table Card */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <colgroup>
              <col style={{ width: "17%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold text-foreground py-3 px-4">المالك</TableHead>
                <TableHead className="font-semibold text-foreground py-3">المحطة</TableHead>
                <TableHead className="font-semibold text-foreground py-3">الهاتف</TableHead>
                <TableHead className="font-semibold text-foreground py-3">الحالة</TableHead>
                <TableHead className="font-semibold text-foreground py-3">الذمة (د.ع)</TableHead>
                <TableHead className="font-semibold text-foreground py-3">تاريخ الإنشاء</TableHead>
                <TableHead className="font-semibold text-foreground py-3 text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {owners.map((o) => (
                <TableRow key={o.id} className={`hover:bg-muted/30 transition-colors ${!o.is_active ? "opacity-50" : ""}`}>
                  <TableCell className="font-semibold px-4 py-3">{o.owner_name}</TableCell>
                  <TableCell className="py-3 text-muted-foreground">{o.stations?.name || "-"}</TableCell>
                  <TableCell className="py-3 font-mono text-sm" dir="ltr">{o.owner_phone || "-"}</TableCell>
                  <TableCell className="py-3">
                    <Badge
                      variant={o.is_active ? "default" : "secondary"}
                      className={o.is_active ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-500"}
                    >
                      {o.is_active ? "● نشط" : "○ موقوف"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-sm font-mono">
                    {o.outstanding_debt > 0
                      ? <span className="text-red-600 font-semibold">{o.outstanding_debt.toLocaleString("ar-IQ")}</span>
                      : <span className="text-green-600">0</span>}
                  </TableCell>
                  <TableCell className="py-3 text-muted-foreground text-sm">{new Date(o.created_at).toLocaleDateString("ar-IQ")}</TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50" onClick={() => openEdit(o)}>
                            <Pencil className="h-3.5 w-3.5 text-blue-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>تعديل</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className={`h-8 w-8 ${o.is_active ? "hover:bg-yellow-50" : "hover:bg-green-50"}`} onClick={() => handleToggleActive(o)}>
                            {o.is_active
                              ? <EyeOff className="h-3.5 w-3.5 text-yellow-500" />
                              : <Eye className="h-3.5 w-3.5 text-green-500" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{o.is_active ? "إيقاف مؤقت" : "تفعيل"}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50" onClick={() => setDeleteTarget(o)}>
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
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-16">
                    <div className="flex flex-col items-center gap-2">
                      <UserPlus className="h-8 w-8 text-muted-foreground/40" />
                      <span>لا توجد حسابات بعد</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تعديل بيانات المالك</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>اسم المالك</Label><Input value={editForm.owner_name} onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })} /></div>
            <div><Label>رقم الهاتف (واتساب)</Label><Input value={editForm.owner_phone} onChange={(e) => setEditForm({ ...editForm, owner_phone: e.target.value })} placeholder="964XXXXXXXXX" /></div>
            <div>
              <Label>الذمة المالية المستحقة (دينار عراقي)</Label>
              <Input
                type="number"
                min="0"
                value={editForm.outstanding_debt}
                onChange={(e) => setEditForm({ ...editForm, outstanding_debt: e.target.value })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">المبلغ الذي سيظهر للمالك عند إيقاف حسابه</p>
            </div>
            <div>
              <Label>المحطة</Label>
              <Select value={editForm.station_id} onValueChange={(v) => setEditForm({ ...editForm, station_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر المحطة" /></SelectTrigger>
                <SelectContent>{stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button onClick={handleEdit} disabled={loading}>{loading ? "جاري الحفظ..." : "حفظ التعديلات"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف حساب <strong>{deleteTarget?.owner_name}</strong>؟
              <br />سيتم حذف الحساب والمستخدم بشكل نهائي ولا يمكن التراجع.
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
