import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { toast } from "@/hooks/use-toast";
import { Loader2, MessagesSquare, Pencil, Plus, Search, Trash2, Users } from "lucide-react";

type OwnerOption = {
  userId: string;
  label: string;
};

type CustomerOption = {
  phone: string;
  label: string;
};

type Group = {
  id: string;
  name: string;
  ownerCount: number;
  customerCount: number;
  lastMessageAt: string | null;
};

const emptyForm = () => ({ name: "", ownerUserIds: new Set<string>(), customerPhones: new Set<string>() });

const MemberPicker = ({
  label,
  icon,
  options,
  selected,
  onToggle,
}: {
  label: string;
  icon: React.ReactNode;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) => {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, search]);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        {icon}
        {label}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between font-normal">
            <span className="truncate">
              {selected.size > 0 ? `${selected.size} محدد` : "اختر..."}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[22rem] max-w-[90vw] p-2">
          <div className="relative mb-2">
            <Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="بحث..."
              className="h-8 pr-7 text-sm"
            />
          </div>
          <ScrollArea className="h-56">
            {filtered.length === 0 ? (
              <p className="p-2 text-center text-xs text-muted-foreground">لا نتائج</p>
            ) : (
              filtered.map((option) => (
                <label
                  key={option.value}
                  className="flex min-w-0 cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={selected.has(option.value)}
                    onCheckedChange={() => onToggle(option.value)}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">{option.label}</span>
                </label>
              ))
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const ChatGroupsTab = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([]);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<Group | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());

  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadOptions = useCallback(async () => {
    const [ownersRes, customersRes] = await Promise.all([
      supabase.from("station_owners").select("user_id, owner_name, owner_phone, stations(name)"),
      supabase.from("customer_profiles").select("customer_phone, customer_name").order("customer_name"),
    ]);

    setOwnerOptions(
      (ownersRes.data || []).map((row: any) => ({
        userId: row.user_id,
        label: `${row.owner_name}${row.stations?.name ? ` — ${row.stations.name}` : ""}`,
      })),
    );
    setCustomerOptions(
      (customersRes.data || []).map((row: any) => ({
        phone: row.customer_phone,
        label: row.customer_name ? `${row.customer_name} (${row.customer_phone})` : row.customer_phone,
      })),
    );
  }, []);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    const { data: threads } = await supabase
      .from("chat_threads")
      .select("id, name, last_message_at")
      .eq("kind", "group")
      .order("created_at", { ascending: false });

    const groupList = await Promise.all(
      (threads || []).map(async (thread: any) => {
        const { data: members } = await supabase
          .from("chat_thread_members")
          .select("user_id, customer_phone")
          .eq("thread_id", thread.id);

        return {
          id: thread.id,
          name: thread.name || "بدون اسم",
          lastMessageAt: thread.last_message_at,
          ownerCount: (members || []).filter((member: any) => member.user_id).length,
          customerCount: (members || []).filter((member: any) => member.customer_phone).length,
        };
      }),
    );

    setGroups(groupList);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOptions();
    loadGroups();
  }, [loadOptions, loadGroups]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((group) => group.name.toLowerCase().includes(query));
  }, [groups, search]);

  const toggleSet = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const handleCreate = async () => {
    const name = createForm.name.trim();
    if (!name) {
      toast({ title: "أدخل اسم المجموعة", variant: "destructive" });
      return;
    }
    if (createForm.ownerUserIds.size === 0 && createForm.customerPhones.size === 0) {
      toast({ title: "اختر عضواً واحداً على الأقل", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .insert({ kind: "group", name, created_by: auth.user?.id || null })
      .select("id")
      .single();

    if (threadError || !thread) {
      setSaving(false);
      toast({ title: "تعذر إنشاء المجموعة", description: threadError?.message, variant: "destructive" });
      return;
    }

    const memberRows = [
      ...[...createForm.ownerUserIds].map((userId) => ({ thread_id: thread.id, user_id: userId })),
      ...[...createForm.customerPhones].map((phone) => ({ thread_id: thread.id, customer_phone: phone })),
    ];
    const { error: membersError } = await supabase.from("chat_thread_members").insert(memberRows);
    setSaving(false);

    if (membersError) {
      toast({ title: "تعذر إضافة الأعضاء", description: membersError.message, variant: "destructive" });
      return;
    }

    toast({ title: "تم إنشاء المجموعة" });
    setCreateOpen(false);
    setCreateForm(emptyForm());
    loadGroups();
  };

  const openEdit = async (group: Group) => {
    const { data: members } = await supabase
      .from("chat_thread_members")
      .select("user_id, customer_phone")
      .eq("thread_id", group.id);

    setEditForm({
      name: group.name,
      ownerUserIds: new Set((members || []).filter((member: any) => member.user_id).map((member: any) => member.user_id)),
      customerPhones: new Set(
        (members || []).filter((member: any) => member.customer_phone).map((member: any) => member.customer_phone),
      ),
    });
    setEditTarget(group);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    const name = editForm.name.trim();
    if (!name) {
      toast({ title: "أدخل اسم المجموعة", variant: "destructive" });
      return;
    }

    setSaving(true);

    const { error: renameError } = await supabase.from("chat_threads").update({ name }).eq("id", editTarget.id);
    if (renameError) {
      setSaving(false);
      toast({ title: "تعذر حفظ الاسم", description: renameError.message, variant: "destructive" });
      return;
    }

    const { data: currentMembers } = await supabase
      .from("chat_thread_members")
      .select("id, user_id, customer_phone")
      .eq("thread_id", editTarget.id);

    const currentOwnerIds = new Set(
      (currentMembers || []).filter((member: any) => member.user_id).map((member: any) => member.user_id as string),
    );
    const currentCustomerPhones = new Set(
      (currentMembers || [])
        .filter((member: any) => member.customer_phone)
        .map((member: any) => member.customer_phone as string),
    );

    const ownersToAdd = [...editForm.ownerUserIds].filter((id) => !currentOwnerIds.has(id));
    const ownersToRemove = (currentMembers || []).filter(
      (member: any) => member.user_id && !editForm.ownerUserIds.has(member.user_id),
    );
    const customersToAdd = [...editForm.customerPhones].filter((phone) => !currentCustomerPhones.has(phone));
    const customersToRemove = (currentMembers || []).filter(
      (member: any) => member.customer_phone && !editForm.customerPhones.has(member.customer_phone),
    );

    const removeIds = [...ownersToRemove, ...customersToRemove].map((member: any) => member.id);
    if (removeIds.length > 0) {
      await supabase.from("chat_thread_members").delete().in("id", removeIds);
    }

    const addRows = [
      ...ownersToAdd.map((userId) => ({ thread_id: editTarget.id, user_id: userId })),
      ...customersToAdd.map((phone) => ({ thread_id: editTarget.id, customer_phone: phone })),
    ];
    if (addRows.length > 0) {
      await supabase.from("chat_thread_members").insert(addRows);
    }

    setSaving(false);
    toast({ title: "تم حفظ التغييرات" });
    setEditTarget(null);
    loadGroups();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("chat_threads").delete().eq("id", deleteTarget.id);
    setDeleting(false);

    if (error) {
      toast({ title: "تعذر حذف المجموعة", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "تم حذف المجموعة" });
    setDeleteTarget(null);
    loadGroups();
  };

  const ownerSelectOptions = ownerOptions.map((option) => ({ value: option.userId, label: option.label }));
  const customerSelectOptions = customerOptions.map((option) => ({ value: option.phone, label: option.label }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">مجموعات المحادثة</h1>
          <p className="text-sm text-muted-foreground">أنشئ مجموعات محادثة تجمع أصحاب محطات وزبائن معاً.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => setCreateForm(emptyForm())}>
              <Plus className="h-4 w-4" />
              مجموعة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>مجموعة جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>اسم المجموعة</Label>
                <Input
                  value={createForm.name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="مثال: أصحاب محطات بغداد"
                />
              </div>
              <MemberPicker
                label="أصحاب المحطات"
                icon={<Users className="h-4 w-4" />}
                options={ownerSelectOptions}
                selected={createForm.ownerUserIds}
                onToggle={(value) =>
                  setCreateForm((prev) => ({ ...prev, ownerUserIds: toggleSet(prev.ownerUserIds, value) }))
                }
              />
              <MemberPicker
                label="الزبائن"
                icon={<Users className="h-4 w-4" />}
                options={customerSelectOptions}
                selected={createForm.customerPhones}
                onToggle={(value) =>
                  setCreateForm((prev) => ({ ...prev, customerPhones: toggleSet(prev.customerPhones, value) }))
                }
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "إنشاء"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ابحث في المجموعات..."
          className="pr-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="text-center">
              <TableRow>
                <TableHead className="text-center">الاسم</TableHead>
                <TableHead className="text-center">أصحاب المحطات</TableHead>
                <TableHead className="text-center">الزبائن</TableHead>
                <TableHead className="text-center">آخر نشاط</TableHead>
                <TableHead className="text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    <MessagesSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                    لا توجد مجموعات
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium text-center">{group.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{group.ownerCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{group.customerCount}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground text-center">
                      {group.lastMessageAt ? new Date(group.lastMessageAt).toLocaleString("ar") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(group)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(group)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل المجموعة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>اسم المجموعة</Label>
              <Input value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <MemberPicker
              label="أصحاب المحطات"
              icon={<Users className="h-4 w-4" />}
              options={ownerSelectOptions}
              selected={editForm.ownerUserIds}
              onToggle={(value) => setEditForm((prev) => ({ ...prev, ownerUserIds: toggleSet(prev.ownerUserIds, value) }))}
            />
            <MemberPicker
              label="الزبائن"
              icon={<Users className="h-4 w-4" />}
              options={customerSelectOptions}
              selected={editForm.customerPhones}
              onToggle={(value) => setEditForm((prev) => ({ ...prev, customerPhones: toggleSet(prev.customerPhones, value) }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              إلغاء
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المجموعة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف مجموعة "{deleteTarget?.name}" وكل رسائلها نهائياً. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChatGroupsTab;
