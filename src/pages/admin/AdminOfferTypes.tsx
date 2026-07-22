import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit, Loader2, Plus, Search, Tags, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppLanguage } from "@/lib/language";
import { adminOffersTexts } from "@/lib/adminOffersTranslations";
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

type OfferType = {
  id: string;
  name: string;
};

const AdminOfferTypes = () => {
  const { language, isRtl } = useAppLanguage();
  const t = adminOffersTexts[language].offerTypes;
  const [rows, setRows] = useState<OfferType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OfferType | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<OfferType | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("offer_types")
      .select("id, name")
      .order("name", { ascending: true });
    setLoading(false);

    if (error) {
      toast({ title: t.loadError, description: error.message, variant: "destructive" });
      return;
    }

    setRows((data || []) as OfferType[]);
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

  const openEdit = (row: OfferType) => {
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
      ? (supabase as any).from("offer_types").update({ name: cleanedName }).eq("id", editing.id)
      : (supabase as any).from("offer_types").insert({ name: cleanedName });

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
    const { error } = await (supabase as any).from("offer_types").delete().eq("id", targetId);
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
              <Label htmlFor="offer-type-name">{t.name}</Label>
              <Input
                id="offer-type-name"
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

export default AdminOfferTypes;
