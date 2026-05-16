import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";

type CustomerProfileRow = {
  id: string;
  customer_phone: string;
  customer_name: string;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
  created_at: string;
  updated_at: string;
};

const AdminCustomers = () => {
  const [rows, setRows] = useState<CustomerProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("customer_profiles")
      .select("id, customer_phone, customer_name, is_blocked, blocked_reason, blocked_at, created_at, updated_at")
      .order("updated_at", { ascending: false });

    setLoading(false);
    if (error) {
      toast({ title: "تعذر تحميل حسابات الزبائن", description: error.message, variant: "destructive" });
      return;
    }

    setRows((data || []) as CustomerProfileRow[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      row.customer_name.toLowerCase().includes(q) || row.customer_phone.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const toggleBlock = async (row: CustomerProfileRow) => {
    setSavingId(row.id);

    const nextBlocked = !row.is_blocked;
    const payload = nextBlocked
      ? {
          is_blocked: true,
          blocked_reason: "مخالفة الشروط أو إساءة استخدام",
          blocked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : {
          is_blocked: false,
          blocked_reason: null,
          blocked_at: null,
          updated_at: new Date().toISOString(),
        };

    const { error } = await (supabase as any).from("customer_profiles").update(payload).eq("id", row.id);
    setSavingId(null);

    if (error) {
      toast({ title: "تعذر تحديث حالة الحظر", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: nextBlocked ? "تم حظر الزبون" : "تم فك حظر الزبون" });
    await load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>حسابات الزبائن</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="بحث بالاسم أو رقم الواتساب"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-sm"
            />
            <Badge variant="outline">المجموع: {filteredRows.length}</Badge>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>رقم الواتساب</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>سبب الحظر</TableHead>
                  <TableHead>إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      لا توجد حسابات.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.customer_name}</TableCell>
                      <TableCell dir="ltr">{row.customer_phone}</TableCell>
                      <TableCell>
                        <Badge variant={row.is_blocked ? "destructive" : "secondary"}>
                          {row.is_blocked ? "محظور" : "نشط"}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.blocked_reason || "-"}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={row.is_blocked ? "outline" : "destructive"}
                          disabled={savingId === row.id}
                          onClick={() => void toggleBlock(row)}
                        >
                          {row.is_blocked ? "فك الحظر" : "حظر"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCustomers;
