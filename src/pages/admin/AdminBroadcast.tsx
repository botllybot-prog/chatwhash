import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Send, Users, CheckCircle, XCircle, Megaphone } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Owner {
  id: string;
  owner_name: string;
  owner_phone: string | null;
  is_active: boolean;
  stations: { name: string } | null;
}

const AdminBroadcast = () => {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ name: string; ok: boolean }[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "suspended">("all");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("station_owners")
        .select("id, owner_name, owner_phone, is_active, stations(name)")
        .not("owner_phone", "is", null)
        .order("owner_name");
      if (data) setOwners(data as Owner[]);
    };
    load();
  }, []);

  const filtered = owners.filter((o) => {
    if (filter === "active") return o.is_active;
    if (filter === "suspended") return !o.is_active;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(filtered.map((o) => o.id)));
  };

  const deselectAll = () => setSelected(new Set());

  const handleSend = async () => {
    if (!message.trim()) {
      toast({ title: "الرسالة فارغة", variant: "destructive" });
      return;
    }
    if (selected.size === 0) {
      toast({ title: "لم تختر أحداً", variant: "destructive" });
      return;
    }

    const targets = owners.filter((o) => selected.has(o.id) && o.owner_phone);
    setSending(true);
    setProgress(0);
    setResults([]);

    const newResults: { name: string; ok: boolean }[] = [];
    for (let i = 0; i < targets.length; i++) {
      const owner = targets[i];
      try {
        const res = await supabase.functions.invoke("whatsapp-send", {
          body: { phone: owner.owner_phone, message: message.trim() },
        });
        newResults.push({ name: owner.owner_name, ok: !res.error && !res.data?.error });
      } catch {
        newResults.push({ name: owner.owner_name, ok: false });
      }
      setProgress(Math.round(((i + 1) / targets.length) * 100));
      setResults([...newResults]);
    }

    setSending(false);
    const successCount = newResults.filter((r) => r.ok).length;
    toast({ title: `تم الإرسال: ${successCount}/${targets.length} ناجح` });
  };

  const sentOk = results.filter((r) => r.ok).length;
  const sentFail = results.filter((r) => !r.ok).length;

  return (
    <div className="space-y-6 max-w-3xl" dir="rtl">
      <div className="flex items-center gap-3">
        <Megaphone className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">رسائل جماعية</h1>
          <p className="text-sm text-muted-foreground">إرسال رسائل واتساب لأصحاب المغاسل</p>
        </div>
      </div>

      {/* Message */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">الرسالة</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="اكتب رسالتك هنا..."
            rows={5}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1.5">{message.length} حرف</p>
        </CardContent>
      </Card>

      {/* Recipients */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> المستقبلون
                {selected.size > 0 && <Badge>{selected.size} محدد</Badge>}
              </CardTitle>
              <CardDescription>اختر من يستقبل الرسالة</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>تحديد الكل</Button>
              <Button variant="ghost" size="sm" onClick={deselectAll}>إلغاء الكل</Button>
            </div>
          </div>
          {/* Filter */}
          <div className="flex gap-2 mt-2">
            {(["all", "active", "suspended"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
                className="text-xs h-7"
              >
                {f === "all" ? "الكل" : f === "active" ? "النشطون" : "الموقوفون"}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا يوجد أصحاب مغاسل</p>
            ) : (
              filtered.map((owner) => (
                <div
                  key={owner.id}
                  onClick={() => owner.owner_phone && toggleSelect(owner.id)}
                  className={`flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors hover:bg-muted/50 ${selected.has(owner.id) ? "border-primary bg-primary/5" : ""} ${!owner.owner_phone ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <Checkbox
                    checked={selected.has(owner.id)}
                    disabled={!owner.owner_phone}
                    onCheckedChange={() => owner.owner_phone && toggleSelect(owner.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{owner.owner_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {owner.stations?.name && <span className="ml-2">{owner.stations.name}</span>}
                      {owner.owner_phone ? <span dir="ltr">{owner.owner_phone}</span> : <span className="text-destructive">لا يوجد رقم</span>}
                    </p>
                  </div>
                  {!owner.is_active && <Badge variant="secondary" className="text-[10px]">موقوف</Badge>}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Send button */}
      <Button
        onClick={handleSend}
        disabled={sending || selected.size === 0 || !message.trim()}
        className="w-full"
        size="lg"
      >
        <Send className="h-4 w-4 ml-2" />
        {sending ? `جاري الإرسال... ${progress}%` : `إرسال إلى ${selected.size} شخص`}
      </Button>

      {/* Progress */}
      {sending && <Progress value={progress} className="h-2" />}

      {/* Results */}
      {results.length > 0 && !sending && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-3">
              نتائج الإرسال
              <Badge className="bg-green-500 text-white">{sentOk} ناجح</Badge>
              {sentFail > 0 && <Badge variant="destructive">{sentFail} فشل</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {r.ok
                    ? <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                  <span className={!r.ok ? "text-muted-foreground" : ""}>{r.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminBroadcast;
