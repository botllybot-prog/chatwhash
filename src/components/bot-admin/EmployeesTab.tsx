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

interface Employee {
  id: string;
  user_id: string;
  name: string;
  email: string;
  can_create_owners: boolean;
  can_create_stations: boolean;
  is_active: boolean;
  created_at: string;
  stations_count?: number;
  owners_count?: number;
}

const EMPTY_FORM = { name: "", email: "", password: "", can_create_owners: false, can_create_stations: false };

export default function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      // Get station and owner counts per employee
      const enriched = await Promise.all(
        data.map(async (emp) => {
          const [stRes, owRes] = await Promise.all([
            supabase.from("stations").select("id", { count: "exact", head: true }).eq("created_by", emp.user_id),
            supabase.from("station_owners").select("id", { count: "exact", head: true }).eq("created_by", emp.user_id),
          ]);
          return { ...emp, stations_count: stRes.count || 0, owners_count: owRes.count || 0 };
        })
      );
      setEmployees(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      toast({ title: "خطأ", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
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
      },
    });
    setSaving(false);
    if (res.error || res.data?.error) {
      toast({ title: "خطأ", description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({ title: "تم إنشاء حساب الموظف بنجاح" });
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
      })
      .eq("id", editTarget.id);
    setSaving(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم تحديث بيانات الموظف" });
      setShowEdit(false);
      load();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await supabase.functions.invoke("delete-employee", {
      body: { employee_id: deleteTarget.id },
    });
    if (res.error || res.data?.error) {
      toast({ title: "خطأ", description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({ title: "تم حذف الموظف" });
      setDeleteTarget(null);
      load();
    }
  };

  const handleToggleActive = async (emp: Employee) => {
    const { error } = await supabase
      .from("employees")
      .update({ is_active: !emp.is_active })
      .eq("id", emp.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      load();
    }
  };

  const handleExportExcel = async (emp: Employee) => {
    // Fetch stations created by this employee
    const { data: stations } = await supabase
      .from("stations")
      .select("name, address, is_active, created_at, station_owners(owner_name, owner_phone)")
      .eq("created_by", emp.user_id)
      .order("created_at", { ascending: false });

    // Fetch owners created by this employee
    const { data: owners } = await supabase
      .from("station_owners")
      .select("owner_name, owner_phone, created_at, stations(name)")
      .eq("created_by", emp.user_id)
      .order("created_at", { ascending: false });

    const wb = XLSX.utils.book_new();

    // Sheet 1: Stations
    const stationsData = (stations || []).map((s: any) => ({
      "اسم المحطة": s.name || "",
      "العنوان": s.address || "",
      "الحالة": s.is_active ? "نشطة" : "موقوفة",
      "صاحب المحطة": s.station_owners?.[0]?.owner_name || "",
      "هاتف الصاحب": s.station_owners?.[0]?.owner_phone || "",
      "تاريخ الإنشاء": new Date(s.created_at).toLocaleDateString("ar-IQ"),
    }));
    const ws1 = XLSX.utils.json_to_sheet(stationsData.length ? stationsData : [{ "لا توجد محطات": "" }]);
    XLSX.utils.book_append_sheet(wb, ws1, "المحطات");

    // Sheet 2: Owners
    const ownersData = (owners || []).map((o: any) => ({
      "اسم صاحب المغسلة": o.owner_name || "",
      "رقم الهاتف": o.owner_phone || "",
      "اسم المحطة": (o.stations as any)?.name || "",
      "تاريخ التسجيل": new Date(o.created_at).toLocaleDateString("ar-IQ"),
    }));
    const ws2 = XLSX.utils.json_to_sheet(ownersData.length ? ownersData : [{ "لا توجد حسابات": "" }]);
    XLSX.utils.book_append_sheet(wb, ws2, "أصحاب المغاسل");

    // Sheet 3: Summary
    const summaryData = [
      { "البيان": "اسم الموظف", "القيمة": emp.name },
      { "البيان": "البريد الإلكتروني", "القيمة": emp.email },
      { "البيان": "عدد المحطات المسجلة", "القيمة": emp.stations_count || 0 },
      { "البيان": "عدد أصحاب المغاسل المسجلين", "القيمة": emp.owners_count || 0 },
      { "البيان": "تاريخ التقرير", "القيمة": new Date().toLocaleDateString("ar-IQ") },
    ];
    const ws3 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws3, "الملخص");

    XLSX.writeFile(wb, `موظف_${emp.name}_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "تم تصدير ملف Excel بنجاح" });
  };

  const openEdit = (emp: Employee) => {
    setEditTarget(emp);
    setForm({ name: emp.name, email: emp.email, password: "", can_create_owners: emp.can_create_owners, can_create_stations: emp.can_create_stations });
    setShowEdit(true);
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">الموظفون</h2>
          <Badge variant="secondary">{employees.length}</Badge>
        </div>
        <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setShowCreate(true); }}>
          <Plus className="h-4 w-4 ml-1" /> إضافة موظف
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
      ) : employees.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">لا يوجد موظفون. أضف موظفاً جديداً.</div>
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
                <th className="text-right px-3 py-2 font-medium">الاسم</th>
                <th className="text-right px-3 py-2 font-medium">البريد الإلكتروني</th>
                <th className="text-right px-3 py-2 font-medium">الصلاحيات</th>
                <th className="text-center px-3 py-2 font-medium">محطات</th>
                <th className="text-center px-3 py-2 font-medium">حسابات</th>
                <th className="text-center px-3 py-2 font-medium">الحالة</th>
                <th className="text-center px-3 py-2 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className={`border-t hover:bg-muted/30 transition-opacity ${!emp.is_active ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2 font-medium">{emp.name}</td>
                  <td className="px-3 py-2 text-muted-foreground" dir="ltr">{emp.email}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {emp.can_create_owners && <Badge variant="outline" className="text-[11px]">إنشاء حسابات</Badge>}
                      {emp.can_create_stations && <Badge variant="outline" className="text-[11px]">إنشاء محطات</Badge>}
                      {!emp.can_create_owners && !emp.can_create_stations && <span className="text-muted-foreground text-xs">لا صلاحيات</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant="secondary">{emp.stations_count}</Badge>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant="secondary">{emp.owners_count}</Badge>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {emp.is_active
                      ? <span className="text-green-600 text-xs font-medium">● نشط</span>
                      : <span className="text-gray-400 text-xs font-medium">○ موقوف</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="تصدير Excel" onClick={() => handleExportExcel(emp)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="تعديل" onClick={() => openEdit(emp)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={emp.is_active ? "إيقاف مؤقت" : "تفعيل"} onClick={() => handleToggleActive(emp)}>
                        {emp.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="حذف" onClick={() => setDeleteTarget(emp)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة موظف جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>الاسم *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الموظف" />
            </div>
            <div className="space-y-1.5">
              <Label>البريد الإلكتروني *</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" dir="ltr" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label>كلمة المرور *</Label>
              <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label>الصلاحيات</Label>
              <div className="flex items-center gap-2">
                <Checkbox id="oc" checked={form.can_create_owners} onCheckedChange={(v) => setForm({ ...form, can_create_owners: !!v })} />
                <label htmlFor="oc" className="text-sm cursor-pointer">إنشاء حسابات أصحاب المغاسل</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="sc" checked={form.can_create_stations} onCheckedChange={(v) => setForm({ ...form, can_create_stations: !!v })} />
                <label htmlFor="sc" className="text-sm cursor-pointer">إنشاء محطات</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "جاري الإنشاء..." : "إنشاء الحساب"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الموظف</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>الاسم</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>البريد الإلكتروني</Label>
              <Input value={form.email} disabled dir="ltr" className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label>الصلاحيات</Label>
              <div className="flex items-center gap-2">
                <Checkbox id="oc2" checked={form.can_create_owners} onCheckedChange={(v) => setForm({ ...form, can_create_owners: !!v })} />
                <label htmlFor="oc2" className="text-sm cursor-pointer">إنشاء حسابات أصحاب المغاسل</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="sc2" checked={form.can_create_stations} onCheckedChange={(v) => setForm({ ...form, can_create_stations: !!v })} />
                <label htmlFor="sc2" className="text-sm cursor-pointer">إنشاء محطات</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>إلغاء</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ التغييرات"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف حساب الموظف <strong>{deleteTarget?.name}</strong>؟ سيتم حذف حساب الدخول نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
