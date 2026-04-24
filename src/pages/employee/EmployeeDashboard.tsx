import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Store, Users, Building, PlusCircle, Tag, MapPin, LocateFixed } from "lucide-react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const ERBIL_CENTER = { lat: 36.191, lng: 44.009 };

const EmployeeDashboard = () => {
  const [employee, setEmployee] = useState<any>(null);
  const [stats, setStats] = useState({ stations: 0, owners: 0 });
  const [stations, setStations] = useState<any[]>([]);
  const [showCreateOwner, setShowCreateOwner] = useState(false);
  const [showCreateStation, setShowCreateStation] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [showEditPrice, setShowEditPrice] = useState(false);

  const [ownerForm, setOwnerForm] = useState({
    email: "",
    password: "",
    owner_name: "",
    owner_phone: "",
    station_id: ""
  });

  const [stationForm, setStationForm] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: ""
  });

  const [serviceForm, setServiceForm] = useState({
    station_id: "",
    name: "",
    price: ""
  });

  const [editPriceForm, setEditPriceForm] = useState({
    service_id: "",
    price: ""
  });

  const [services, setServices] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY
  });

  const mapLat = parseFloat(stationForm.latitude) || ERBIL_CENTER.lat;
  const mapLng = parseFloat(stationForm.longitude) || ERBIL_CENTER.lng;
  const mapCenter = { lat: mapLat, lng: mapLng };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast({ title: "المتصفح لا يدعم تحديد الموقع", variant: "destructive" });
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStationForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocating(false);
        toast({ title: "✅ تم تحديد موقعك الحالي" });
      },
      () => {
        setLocating(false);
        toast({ title: "تعذّر تحديد الموقع", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: emp }, { data: sts }] = await Promise.all([
        supabase.from("employees").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("stations").select("id, name").order("name"),
      ]);

      if (emp) setEmployee(emp);
      if (sts) setStations(sts);

      const { data: svcs } = await supabase
        .from("services")
        .select("id, name, price, station_id, stations(name)")
        .order("name");

      if (svcs) setServices(svcs);

      const [stRes, owRes] = await Promise.all([
        supabase.from("stations").select("id", { count: "exact", head: true }),
        supabase.from("station_owners").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        stations: stRes.count || 0,
        owners: owRes.count || 0
      });
    };

    load();
  }, []);

  const handleAddService = async () => {
    if (!employee?.can_add_service) {
      toast({ title: "لا تملك صلاحية", variant: "destructive" });
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("services").insert({
      station_id: serviceForm.station_id,
      name: serviceForm.name,
      price: parseFloat(serviceForm.price),
      is_active: true,
    });

    setSaving(false);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تمت إضافة الخدمة" });
      setShowAddService(false);
      setServiceForm({ station_id: "", name: "", price: "" });
    }
  };

  const handleEditPrice = async () => {
    setSaving(true);

    const { error } = await supabase
      .from("services")
      .update({ price: parseFloat(editPriceForm.price) })
      .eq("id", editPriceForm.service_id);

    setSaving(false);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم تحديث السعر" });
      setShowEditPrice(false);
      setEditPriceForm({ service_id: "", price: "" });
    }
  };

  const handleCreateOwner = async () => {
    setSaving(true);

    const res = await supabase.functions.invoke("create-station-owner", {
      body: ownerForm,
    });

    setSaving(false);

    if (res.error || res.data?.error) {
      toast({ title: "خطأ", description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({ title: "تم إنشاء الحساب" });
      setShowCreateOwner(false);
    }
  };

  const handleCreateStation = async () => {
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("stations").insert({
      name: stationForm.name,
      address: stationForm.address,
      latitude: stationForm.latitude ? Number(stationForm.latitude) : null,
      longitude: stationForm.longitude ? Number(stationForm.longitude) : null,
      created_by: user?.id,
      is_active: true,
    });

    setSaving(false);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم إنشاء المحطة" });
      setShowCreateStation(false);
      setStationForm({ name: "", address: "", latitude: "", longitude: "" });
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">لوحة الموظف</h1>

      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => setShowCreateStation(true)}>
          <Store className="w-4 h-4 ml-2" /> إضافة محطة
        </Button>

        <Button onClick={() => setShowCreateOwner(true)}>
          <UserPlus className="w-4 h-4 ml-2" /> إنشاء صاحب
        </Button>
      </div>

      {/* Create Station */}
      <Dialog open={showCreateStation} onOpenChange={setShowCreateStation}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>إضافة محطة</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Input placeholder="اسم المحطة" value={stationForm.name}
              onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })} />

            <Input placeholder="العنوان" value={stationForm.address}
              onChange={(e) => setStationForm({ ...stationForm, address: e.target.value })} />

            <div className="h-56 border rounded overflow-hidden">
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={{ width: "100%", height: "100%" }}
                  center={mapCenter}
                  zoom={12}
                  onClick={(e) => {
                    if (e.latLng) {
                      setStationForm({
                        ...stationForm,
                        latitude: e.latLng.lat().toFixed(6),
                        longitude: e.latLng.lng().toFixed(6),
                      });
                    }
                  }}
                >
                  <Marker position={mapCenter} draggable />
                </GoogleMap>
              ) : (
                <div className="flex items-center justify-center h-full">Loading map...</div>
              )}
            </div>

            <Button onClick={handleLocateMe} disabled={locating}>
              <LocateFixed className="w-4 h-4 ml-2" />
              {locating ? "جاري التحديد..." : "موقعي"}
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={handleCreateStation} disabled={saving}>
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Owner */}
      <Dialog open={showCreateOwner} onOpenChange={setShowCreateOwner}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إنشاء صاحب مغسلة</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Input placeholder="الاسم" value={ownerForm.owner_name}
              onChange={(e) => setOwnerForm({ ...ownerForm, owner_name: e.target.value })} />

            <Input placeholder="الإيميل" value={ownerForm.email}
              onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })} />

            <Input placeholder="كلمة المرور" type="password"
              onChange={(e) => setOwnerForm({ ...ownerForm, password: e.target.value })} />
          </div>

          <DialogFooter>
            <Button onClick={handleCreateOwner} disabled={saving}>إنشاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default EmployeeDashboard;
