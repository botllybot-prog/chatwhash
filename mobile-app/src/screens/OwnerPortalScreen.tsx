import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
import { SectionTitle } from "../components/SectionTitle";
import { palette } from "../theme";
import type { OwnerContext, PaymentRow, SubscriptionSummary } from "../types";
import {
  getPackageByCode,
  loadLatestSubscription,
  loadOwnerContext,
  loadOwnerPaymentMethods,
  loadPayments,
  OWNER_PACKAGES,
  type OwnerPaymentMethods,
} from "../lib/subscriptionApi";
import { supabase } from "../lib/supabase";

type OwnerBooking = {
  id: string;
  bookingNumber: number;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string | null;
  status: string;
};

type PaymentMethodCard = {
  code: "zain_cash" | "rafidain" | "nas_wallet" | "card";
  label: string;
  value: string;
  isLink?: boolean;
};

type DayStats = {
  submitted: number;
  accepted: number;
  rejected: number;
};

export function OwnerPortalScreen({ ownerUserId, onLogout }: { ownerUserId: string; onLogout: () => void }) {
  const [loading, setLoading] = useState(true);
  const [savingBookingId, setSavingBookingId] = useState<string | null>(null);
  const [ownerContext, setOwnerContext] = useState<OwnerContext | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<OwnerPaymentMethods>({ zainCash: "", rafidain: "", nasWallet: "", cardUrl: "" });
  const [bookings, setBookings] = useState<OwnerBooking[]>([]);
  const [bookingEdits, setBookingEdits] = useState<Record<string, { date: string; time: string }>>({});
  const [stationProfile, setStationProfile] = useState({ address: "", detailedAddress: "", imageUrl: "" });
  const [dayStats, setDayStats] = useState<DayStats>({ submitted: 0, accepted: 0, rejected: 0 });
  const [savingStationProfile, setSavingStationProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedPackageCode, setSelectedPackageCode] = useState(OWNER_PACKAGES[0].code);
  const [selectedPaymentCode, setSelectedPaymentCode] = useState<PaymentMethodCard["code"]>("zain_cash");
  const [sendingPackageRequest, setSendingPackageRequest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const knownPendingBookingIds = useRef<Set<string>>(new Set());
  const firstBookingPoll = useRef(true);

  const activePackage = getPackageByCode(subscription?.packageCode || null);
  const freeRemaining = Math.max(0, Number(ownerContext?.freeRequestsQuota || 0) - Number(ownerContext?.freeRequestsUsed || 0));
  const subscriptionRemaining =
    subscription?.requestLimit === null
      ? null
      : Math.max(0, Number(subscription?.requestLimit || 0) - Number(subscription?.requestsUsed || 0));

  const methodsList = useMemo<PaymentMethodCard[]>(() => {
    const list: PaymentMethodCard[] = [];
    if (paymentMethods.zainCash) list.push({ code: "zain_cash", label: "زين كاش", value: paymentMethods.zainCash });
    if (paymentMethods.rafidain) list.push({ code: "rafidain", label: "الرافدين", value: paymentMethods.rafidain });
    if (paymentMethods.nasWallet) list.push({ code: "nas_wallet", label: "ناس والت", value: paymentMethods.nasWallet });
    list.push({ code: "card", label: "بطاقة Visa / MasterCard", value: paymentMethods.cardUrl || "سيتفعل رابط الدفع بالبطاقة قريباً", isLink: !!paymentMethods.cardUrl });
    return list;
  }, [paymentMethods]);

  const selectedMethod = methodsList.find((item) => item.code === selectedPaymentCode) || methodsList[0] || null;

  const ownerSlots = useMemo(() => {
    const start = ownerContext?.stationWorkingHoursStart?.slice(0, 5) || "08:00";
    const end = ownerContext?.stationWorkingHoursEnd?.slice(0, 5) || "22:00";
    const step = Math.max(30, Number(ownerContext?.stationSlotDurationMinutes || 30));
    const toMinutes = (value: string) => {
      const [hour, minute] = value.split(":").map(Number);
      return hour * 60 + minute;
    };
    const toHHMM = (value: number) => {
      const safe = ((value % 1440) + 1440) % 1440;
      return `${Math.floor(safe / 60)}`.padStart(2, "0") + ":" + `${safe % 60}`.padStart(2, "0");
    };
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);
    const slots: string[] = [];
    if (endMinutes >= startMinutes) {
      for (let current = startMinutes; current <= endMinutes; current += step) slots.push(toHHMM(current));
    } else {
      for (let current = startMinutes; current < 1440; current += step) slots.push(toHHMM(current));
      for (let current = 0; current <= endMinutes; current += step) slots.push(toHHMM(current));
    }
    return slots;
  }, [ownerContext]);

  const refresh = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const owner = await loadOwnerContext(ownerUserId);
      setOwnerContext(owner);
      setStationProfile({
        address: owner.stationAddress || "",
        detailedAddress: owner.stationDetailedAddress || "",
        imageUrl: owner.stationImageUrl || "",
      });

      const sub = await loadLatestSubscription(owner.stationId).catch(() => null);
      setSubscription(sub);
      const methods = await loadOwnerPaymentMethods().catch(() => ({ zainCash: "", rafidain: "", nasWallet: "", cardUrl: "" }));
      setPaymentMethods(methods);
      setPayments(sub?.id ? await loadPayments(sub.id).catch(() => []) : []);

      let bookingRows: any[] = [];
      const withServices = await (supabase as any)
        .from("bookings")
        .select("id, booking_number, customer_name, customer_phone, booking_date, booking_time, status, services(name)")
        .eq("station_id", owner.stationId)
        .in("status", ["pending", "pending_owner_approval", "pending_customer_approval", "confirmed"])
        .order("created_at", { ascending: false })
        .limit(30);
      if (withServices.error) {
        const withoutServices = await (supabase as any)
          .from("bookings")
          .select("id, booking_number, customer_name, customer_phone, booking_date, booking_time, status")
          .eq("station_id", owner.stationId)
          .in("status", ["pending", "pending_owner_approval", "pending_customer_approval", "confirmed"])
          .order("created_at", { ascending: false })
          .limit(30);
        if (withoutServices.error) throw withoutServices.error;
        bookingRows = withoutServices.data || [];
      } else {
        bookingRows = withServices.data || [];
      }

      const normalizedBookings: OwnerBooking[] = (bookingRows || []).map((row: any) => ({
        id: row.id,
        bookingNumber: Number(row.booking_number || 0),
        customerName: row.customer_name || "عميل",
        customerPhone: row.customer_phone || "",
        serviceName: row.services?.name || "حجز سريع",
        bookingDate: row.booking_date || "",
        bookingTime: row.booking_time || null,
        status: row.status || "pending",
      }));
      setBookings(normalizedBookings);

      const from24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: statRows } = await (supabase as any)
        .from("bookings")
        .select("status")
        .eq("station_id", owner.stationId)
        .gte("created_at", from24h);
      setDayStats({
        submitted: statRows?.length || 0,
        accepted: (statRows || []).filter((row: any) => row.status === "confirmed" || row.status === "completed").length,
        rejected: (statRows || []).filter((row: any) => row.status === "cancelled").length,
      });

      const pendingIds = normalizedBookings
        .filter((booking) => booking.status === "pending" || booking.status === "pending_owner_approval")
        .map((booking) => booking.id);
      const newPending = pendingIds.filter((id) => !knownPendingBookingIds.current.has(id));
      if (!firstBookingPoll.current && newPending.length > 0) {
        Vibration.vibrate([0, 450, 150, 450]);
        Notifications.scheduleNotificationAsync({
          content: {
            title: "حجز جديد",
            body: "وصل حجز جديد للمحطة داخل التطبيق. افتح الحجوزات للقبول أو الرفض.",
            sound: "default",
          },
          trigger: { channelId: "owner-bookings", seconds: 1 },
        }).catch(() => undefined);
        Alert.alert("حجز جديد", "وصل حجز جديد للمحطة داخل التطبيق. افتح الحجوزات للقبول أو الرفض.");
      }
      firstBookingPoll.current = false;
      knownPendingBookingIds.current = new Set(pendingIds);

      const edits: Record<string, { date: string; time: string }> = {};
      for (const booking of normalizedBookings) {
        edits[booking.id] = { date: booking.bookingDate, time: booking.bookingTime?.slice(0, 5) || ownerSlots[0] || "08:00" };
      }
      setBookingEdits(edits);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل بوابة المحطة.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    firstBookingPoll.current = true;
    knownPendingBookingIds.current = new Set();
    Notifications.requestPermissionsAsync().catch(() => undefined);
    Notifications.setNotificationChannelAsync("owner-bookings", {
      name: "Owner booking alerts",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 450, 150, 450],
    }).catch(() => undefined);
    refresh();
    const pollId = setInterval(() => refresh(true), 15000);
    return () => clearInterval(pollId);
  }, [ownerUserId]);

  useEffect(() => {
    if (!selectedMethod && methodsList.length > 0) setSelectedPaymentCode(methodsList[0].code);
  }, [methodsList, selectedMethod]);

  const pickStationImage = async () => {
    if (!ownerContext) return;
    const ImagePicker = await import("expo-image-picker");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("الصورة", "فعّل إذن الصور حتى تقدر تضيف صورة للمحطة.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.78,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    setUploadingImage(true);
    setError(null);
    try {
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const ext = asset.uri.split(".").pop()?.split("?")[0] || "jpg";
      const filePath = `${ownerContext.stationId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("station-images").upload(filePath, blob, {
        contentType: asset.mimeType || "image/jpeg",
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("station-images").getPublicUrl(filePath);
      setStationProfile((prev) => ({ ...prev, imageUrl: data.publicUrl }));
      setNotice("تم رفع الصورة. اضغط حفظ بيانات المحطة لتثبيتها.");
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "تعذر رفع صورة المحطة.");
    } finally {
      setUploadingImage(false);
    }
  };

  const saveStationProfile = async () => {
    if (!ownerContext) return;
    setSavingStationProfile(true);
    setError(null);
    setNotice(null);
    try {
      const { error: updateError } = await (supabase as any)
        .from("stations")
        .update({
          address: stationProfile.address.trim(),
          detailed_address: stationProfile.detailedAddress.trim(),
          image_url: stationProfile.imageUrl.trim() || null,
        })
        .eq("id", ownerContext.stationId);
      if (updateError) {
        const requests = [
          { field_name: "address", old_value: ownerContext.stationAddress || "", new_value: stationProfile.address.trim() },
          { field_name: "detailed_address", old_value: ownerContext.stationDetailedAddress || "", new_value: stationProfile.detailedAddress.trim() },
          { field_name: "image_url", old_value: ownerContext.stationImageUrl || "", new_value: stationProfile.imageUrl.trim() },
        ].filter((item) => item.old_value !== item.new_value && item.new_value);

        if (!requests.length) {
          setNotice("لا توجد تغييرات جديدة لحفظها.");
          return;
        }

        const { error: requestError } = await (supabase as any).from("edit_requests").insert(
          requests.map((item) => ({
            station_id: ownerContext.stationId,
            requested_by: ownerUserId,
            field_name: item.field_name,
            old_value: item.old_value,
            new_value: item.new_value,
          })),
        );
        if (requestError) throw requestError;
        setNotice("تم إرسال طلب تعديل بيانات المحطة للإدارة مثل بوابة الويب.");
      } else {
        setNotice("تم حفظ بيانات المحطة.");
      }
      await refresh(true);
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "تعذر حفظ أو إرسال تعديل بيانات المحطة.");
    } finally {
      setSavingStationProfile(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, status: "confirmed" | "cancelled") => {
    setSavingBookingId(bookingId);
    setError(null);
    setNotice(null);
    try {
      const edit = bookingEdits[bookingId];
      const payload: Record<string, string> = { status };
      if (status === "confirmed" && edit?.date && edit?.time) {
        payload.booking_date = edit.date;
        payload.booking_time = edit.time;
      }
      const { error: updateError } = await (supabase as any).from("bookings").update(payload).eq("id", bookingId);
      if (updateError) throw updateError;
      setNotice(status === "confirmed" ? "تم قبول الحجز." : "تم رفض الحجز.");
      await refresh(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "تعذر تحديث حالة الحجز.");
    } finally {
      setSavingBookingId(null);
    }
  };

  const updateBookingTime = async (bookingId: string) => {
    const edit = bookingEdits[bookingId];
    if (!edit?.date || !edit?.time) {
      Alert.alert("تنبيه", "أدخل التاريخ والوقت قبل الحفظ.");
      return;
    }
    setSavingBookingId(bookingId);
    setError(null);
    setNotice(null);
    try {
      const { error: updateError } = await (supabase as any)
        .from("bookings")
        .update({ booking_date: edit.date, booking_time: edit.time, status: "pending_customer_approval" })
        .eq("id", bookingId);
      if (updateError) throw updateError;
      setNotice("تم إرسال تعديل الوقت للحجز.");
      await refresh(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "تعذر تعديل الموعد.");
    } finally {
      setSavingBookingId(null);
    }
  };

  const sendPackageRequest = async () => {
    if (!ownerContext) return;
    const pkg = getPackageByCode(selectedPackageCode);
    if (!pkg) return;
    setSendingPackageRequest(true);
    setError(null);
    setNotice(null);
    try {
      const message =
        `طلب تجديد/تفعيل باقة من تطبيق Washlly\n\n` +
        `المحطة: ${ownerContext.stationName}\n` +
        `صاحب المحطة: ${ownerContext.ownerName || "-"}\n` +
        `هاتف صاحب المحطة: ${ownerContext.ownerPhone || "-"}\n` +
        `الباقة المطلوبة: ${pkg.title}\n` +
        `السعر: $${pkg.priceUsd}\n` +
        `عدد الطلبات: ${pkg.requestLimit === null ? "غير محدود" : pkg.requestLimit}\n` +
        `طريقة الدفع المختارة: ${selectedMethod?.label || "-"}`;

      const { data: admins } = await (supabase as any).from("user_roles").select("user_id").eq("role", "admin").limit(20);
      const adminNotifications = (admins || []).map((admin: any) => ({
        user_id: admin.user_id,
        title: "طلب تجديد باقة",
        body: message,
        type: "subscription_request",
        reference_id: ownerContext.stationId,
      }));
      if (adminNotifications.length > 0) {
        const { error: notificationError } = await (supabase as any).from("notifications").insert(adminNotifications);
        if (notificationError) throw notificationError;
      }

      const { error: whatsappError } = await supabase.functions.invoke("whatsapp-send", {
        body: { phone: "9647836635435", message },
      });
      if (whatsappError) throw whatsappError;
      setNotice("تم إرسال طلب الباقة للإدارة داخل لوحة الأدمن وعلى واتساب الإدارة.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "تعذر إرسال طلب تجديد الباقة.");
    } finally {
      setSendingPackageRequest(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {loading ? <ActivityIndicator color={palette.deepBlue} style={styles.loader} /> : null}
      {error ? <Notice text={error} kind="error" /> : null}
      {notice ? <Notice text={notice} kind="success" /> : null}

      {ownerContext ? (
        <>
          <View style={styles.profileCard}>
            <Pressable style={styles.imageBox} onPress={pickStationImage} disabled={uploadingImage}>
              {stationProfile.imageUrl ? (
                <Image source={{ uri: stationProfile.imageUrl }} style={styles.stationImage} />
              ) : (
                <Text style={styles.imagePlaceholder}>{uploadingImage ? "جاري الرفع..." : "إضافة صورة"}</Text>
              )}
            </Pressable>
            <View style={styles.profileInfo}>
              <Text style={styles.stationName}>{ownerContext.stationName}</Text>
              <Text style={styles.stationMeta}>{stationProfile.address || "بدون عنوان مختصر"}</Text>
              <Text style={styles.stationMeta}>{stationProfile.detailedAddress || "أضف تفاصيل الوصول للمحطة"}</Text>
              <View style={styles.profileActions}>
                <Pressable style={styles.smallLightBtn} onPress={() => refresh()}>
                  <Text style={styles.smallLightText}>تحديث</Text>
                </Pressable>
                <Pressable style={styles.smallDarkBtn} onPress={onLogout}>
                  <Text style={styles.smallDarkText}>خروج</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Field label="العنوان المختصر" value={stationProfile.address} onChangeText={(address) => setStationProfile((prev) => ({ ...prev, address }))} placeholder="مثال: أربيل - عنكاوا" />
            <Field label="العنوان التفصيلي" value={stationProfile.detailedAddress} onChangeText={(detailedAddress) => setStationProfile((prev) => ({ ...prev, detailedAddress }))} placeholder="قرب الشارع الرئيسي" multiline />
            <Pressable style={[styles.fullPrimaryBtn, savingStationProfile && styles.disabledBtn]} onPress={saveStationProfile} disabled={savingStationProfile}>
              {savingStationProfile ? <ActivityIndicator color={palette.white} /> : <Text style={styles.fullPrimaryBtnText}>حفظ معلومات المحطة</Text>}
            </Pressable>
          </View>

          <SectionTitle title="الحجوزات الجديدة" subtitle="قبول، رفض، أو تعديل وقت الحجز من هنا مباشرة." />
          <View style={styles.card}>
            {bookings.length === 0 ? (
              <Text style={styles.cardSub}>لا توجد حجوزات حالياً.</Text>
            ) : (
              bookings.map((booking) => (
                <View key={booking.id} style={styles.bookingRow}>
                  <Text style={styles.bookingTitle}>#{booking.bookingNumber} - {booking.customerName}</Text>
                  <Text style={styles.bookingSub}>{booking.serviceName} - الحالة: {booking.status}</Text>
                  <View style={styles.bookingEditRow}>
                    <TextInput value={bookingEdits[booking.id]?.date || ""} onChangeText={(date) => setBookingEdits((prev) => ({ ...prev, [booking.id]: { ...prev[booking.id], date } }))} placeholder="YYYY-MM-DD" style={styles.bookingInput} textAlign="center" />
                    <TextInput value={bookingEdits[booking.id]?.time || ""} onChangeText={(time) => setBookingEdits((prev) => ({ ...prev, [booking.id]: { ...prev[booking.id], time } }))} placeholder="HH:mm" style={styles.bookingInput} textAlign="center" />
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ownerSlotList}>
                    {ownerSlots.map((slot) => {
                      const active = bookingEdits[booking.id]?.time?.slice(0, 5) === slot;
                      return (
                        <Pressable key={`${booking.id}-${slot}`} style={[styles.ownerSlotChip, active && styles.ownerSlotChipActive]} onPress={() => setBookingEdits((prev) => ({ ...prev, [booking.id]: { ...prev[booking.id], time: slot } }))}>
                          <Text style={[styles.ownerSlotText, active && styles.ownerSlotTextActive]}>{slot}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <View style={styles.bookingActionRow}>
                    <Pressable style={[styles.acceptBtn, savingBookingId === booking.id && styles.disabledBtn]} onPress={() => updateBookingStatus(booking.id, "confirmed")} disabled={savingBookingId === booking.id}>
                      <Text style={styles.bookingActionText}>موافقة</Text>
                    </Pressable>
                    <Pressable style={[styles.rejectBtn, savingBookingId === booking.id && styles.disabledBtn]} onPress={() => updateBookingStatus(booking.id, "cancelled")} disabled={savingBookingId === booking.id}>
                      <Text style={styles.bookingActionText}>رفض</Text>
                    </Pressable>
                    <Pressable style={[styles.editBtn, savingBookingId === booking.id && styles.disabledBtn]} onPress={() => updateBookingTime(booking.id)} disabled={savingBookingId === booking.id}>
                      <Text style={styles.bookingActionText}>تعديل</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          <SectionTitle title="آخر 24 ساعة" subtitle="ملخص سريع لحركة الحجوزات." />
          <View style={styles.statsRow}>
            <MiniStat title="قدمت اليوم" value={dayStats.submitted} />
            <MiniStat title="اكتملت" value={dayStats.accepted} />
            <MiniStat title="انرفضت" value={dayStats.rejected} />
          </View>

          <SectionTitle title="ملخص الرصيد" subtitle="الباقة المجانية والمدفوعة بحجم مختصر." />
          <View style={styles.compactGrid}>
            <MiniStat title="المجاني" value={freeRemaining} />
            <MiniStat title="المدفوع" value={subscriptionRemaining === null ? "∞" : subscriptionRemaining} />
            <MiniStat title="الباقة" value={activePackage?.title || "لا توجد"} />
          </View>

          <SectionTitle title="الباقات والدفع" subtitle="اختيار الباقة وإرسال طلب التجديد للإدارة." />
          <View style={styles.packageIconGrid}>
            {OWNER_PACKAGES.map((pkg) => {
              const selected = pkg.code === selectedPackageCode;
              return (
                <Pressable key={pkg.code} style={[styles.packageIcon, selected && styles.packageIconActive]} onPress={() => setSelectedPackageCode(pkg.code)}>
                  <Text style={styles.packageCount}>{pkg.requestLimit === null ? "∞" : `${pkg.requestLimit}`}</Text>
                  <Text style={[styles.packageTitle, selected && styles.packageTitleActive]}>{pkg.title}</Text>
                  <Text style={styles.packagePrice}>${pkg.priceUsd}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>طريقة الدفع</Text>
            <Text style={styles.cardSub}>بعد اختيار الباقة اضغط إرسال الطلب، ويصل الطلب للوحة الأدمن وواتساب الإدارة.</Text>
            <View style={styles.paymentMethodGrid}>
              {methodsList.map((method) => {
                const active = method.code === selectedPaymentCode;
                return (
                  <Pressable key={method.code} style={[styles.methodChip, active && styles.methodChipActive]} onPress={() => setSelectedPaymentCode(method.code)}>
                    <Text style={[styles.methodText, active && styles.methodTextActive]}>{method.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {selectedMethod ? (
              <View style={styles.methodDetails}>
                <Text style={styles.methodTitle}>{selectedMethod.label}</Text>
                <Text style={styles.methodValue}>{selectedMethod.value}</Text>
                {selectedMethod.isLink ? (
                  <Pressable style={styles.openLinkBtn} onPress={() => Linking.openURL(selectedMethod.value)}>
                    <Text style={styles.openLinkBtnText}>فتح رابط الدفع</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <Pressable style={[styles.fullPrimaryBtn, sendingPackageRequest && styles.disabledBtn]} onPress={sendPackageRequest} disabled={sendingPackageRequest}>
              {sendingPackageRequest ? <ActivityIndicator color={palette.white} /> : <Text style={styles.fullPrimaryBtnText}>إرسال طلب الباقة للإدارة</Text>}
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>آخر الدفعات</Text>
            {payments.length === 0 ? (
              <Text style={styles.cardSub}>لا توجد دفعات مسجلة بعد.</Text>
            ) : (
              payments.map((payment) => (
                <View key={payment.id} style={styles.paymentRow}>
                  <Text style={styles.paymentMain}>${payment.amount}</Text>
                  <Text style={styles.paymentSub}>{payment.status} - {payment.method || "manual"} - {payment.paymentDate?.slice(0, 10) || "--"}</Text>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8aa0b8" style={[styles.profileInput, multiline && styles.multilineInput]} textAlign="right" multiline={multiline} />
    </View>
  );
}

function MiniStat({ title, value }: { title: string; value: string | number }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatTitle}>{title}</Text>
      <Text style={styles.miniStatValue}>{value}</Text>
    </View>
  );
}

function Notice({ text, kind }: { text: string; kind: "success" | "error" }) {
  return (
    <View style={[styles.notice, kind === "success" ? styles.noticeSuccess : styles.noticeError]}>
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f9fd" },
  content: { padding: 16, paddingBottom: 40 },
  loader: { marginVertical: 18 },
  notice: { borderRadius: 14, padding: 12, marginBottom: 12 },
  noticeSuccess: { backgroundColor: "#e8f6ee", borderColor: "#c8e9d3", borderWidth: 1 },
  noticeError: { backgroundColor: "#fff2f2", borderColor: "#f3c4c4", borderWidth: 1 },
  noticeText: { textAlign: "right", lineHeight: 20, color: palette.text, fontWeight: "700" },
  profileCard: {
    flexDirection: "row-reverse",
    gap: 12,
    backgroundColor: "#092542",
    borderColor: "#184a7c",
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#0b1b2b",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  imageBox: { width: 118, height: 118, borderRadius: 20, backgroundColor: "#eaf3fb", overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.26)" },
  stationImage: { width: "100%", height: "100%" },
  imagePlaceholder: { color: palette.deepBlue, fontWeight: "900", textAlign: "center" },
  profileInfo: { flex: 1 },
  stationName: { textAlign: "right", color: palette.white, fontSize: 25, fontWeight: "900" },
  stationMeta: { textAlign: "right", color: "rgba(255,255,255,0.74)", marginTop: 4, lineHeight: 19 },
  profileActions: { flexDirection: "row-reverse", gap: 8, marginTop: 10 },
  smallLightBtn: { flex: 1, borderRadius: 14, backgroundColor: palette.white, alignItems: "center", paddingVertical: 10 },
  smallLightText: { color: palette.deepBlue, fontWeight: "800" },
  smallDarkBtn: { flex: 1, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  smallDarkText: { color: palette.white, fontWeight: "800" },
  card: {
    borderRadius: 20,
    borderColor: palette.line,
    borderWidth: 1,
    backgroundColor: palette.white,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#0b1b2b",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  cardTitle: { textAlign: "right", color: palette.text, fontWeight: "900", marginBottom: 6, fontSize: 17 },
  cardSub: { textAlign: "right", color: palette.muted, lineHeight: 21 },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { textAlign: "right", color: palette.text, fontWeight: "800", marginBottom: 6 },
  profileInput: { borderWidth: 1, borderColor: palette.line, borderRadius: 14, backgroundColor: "#f8fbfe", paddingHorizontal: 12, paddingVertical: 11, color: palette.text },
  multilineInput: { minHeight: 72, textAlignVertical: "top" },
  fullPrimaryBtn: { marginTop: 8, backgroundColor: palette.deepBlue, borderRadius: 15, alignItems: "center", justifyContent: "center", paddingVertical: 13 },
  fullPrimaryBtnText: { color: palette.white, fontWeight: "900" },
  bookingRow: { borderWidth: 1, borderColor: palette.line, borderRadius: 18, padding: 12, marginBottom: 12, backgroundColor: "#f8fbfe" },
  bookingTitle: { textAlign: "right", color: palette.text, fontWeight: "900", fontSize: 16 },
  bookingSub: { textAlign: "right", color: palette.muted, marginTop: 2 },
  bookingEditRow: { flexDirection: "row-reverse", gap: 8, marginTop: 10 },
  bookingInput: { flex: 1, borderWidth: 1, borderColor: palette.line, borderRadius: 13, backgroundColor: palette.white, paddingVertical: 10, paddingHorizontal: 8, color: palette.text },
  ownerSlotList: { gap: 8, paddingVertical: 10 },
  ownerSlotChip: { borderWidth: 1, borderColor: palette.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: palette.white },
  ownerSlotChipActive: { borderColor: palette.deepBlue, backgroundColor: palette.deepBlue },
  ownerSlotText: { color: palette.text, fontWeight: "700" },
  ownerSlotTextActive: { color: palette.white },
  bookingActionRow: { flexDirection: "row-reverse", gap: 8, marginTop: 4 },
  acceptBtn: { flex: 1, backgroundColor: "#168a4a", borderRadius: 14, paddingVertical: 11, alignItems: "center" },
  rejectBtn: { flex: 1, backgroundColor: "#c24135", borderRadius: 14, paddingVertical: 11, alignItems: "center" },
  editBtn: { flex: 1, backgroundColor: palette.deepBlue, borderRadius: 14, paddingVertical: 11, alignItems: "center" },
  bookingActionText: { color: palette.white, fontWeight: "900", fontSize: 12 },
  statsRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 14 },
  compactGrid: { flexDirection: "row-reverse", gap: 8, marginBottom: 14 },
  miniStat: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.white, padding: 11 },
  miniStatTitle: { textAlign: "right", color: palette.muted, fontSize: 12 },
  miniStatValue: { textAlign: "right", color: palette.deepBlue, fontWeight: "900", fontSize: 20, marginTop: 4 },
  packageIconGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  packageIcon: { width: "48%", borderRadius: 18, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.white, padding: 13, alignItems: "center" },
  packageIconActive: { borderColor: "#19a7ce", backgroundColor: "#e9f8fc" },
  packageCount: { color: palette.deepBlue, fontWeight: "900", fontSize: 22 },
  packageTitle: { color: palette.text, fontWeight: "800", textAlign: "center", marginTop: 6 },
  packageTitleActive: { color: palette.deepBlue },
  packagePrice: { color: palette.deepBlue, fontWeight: "900", marginTop: 4, fontSize: 18 },
  paymentMethodGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 10 },
  methodChip: { borderWidth: 1, borderColor: palette.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#f8fbfe" },
  methodChipActive: { borderColor: palette.brightBlue, backgroundColor: "#eaf3fb" },
  methodText: { color: palette.text, fontWeight: "800", fontSize: 12 },
  methodTextActive: { color: palette.deepBlue },
  methodDetails: { marginTop: 12, borderTopWidth: 1, borderColor: palette.line, paddingTop: 10 },
  methodTitle: { textAlign: "right", color: palette.deepBlue, fontWeight: "900" },
  methodValue: { textAlign: "right", color: palette.text, marginTop: 4, lineHeight: 20 },
  openLinkBtn: { marginTop: 10, alignSelf: "flex-end", backgroundColor: palette.deepBlue, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  openLinkBtnText: { color: palette.white, fontWeight: "800" },
  paymentRow: { borderColor: palette.line, borderBottomWidth: 1, paddingBottom: 8, marginBottom: 8 },
  paymentMain: { textAlign: "right", color: palette.deepBlue, fontWeight: "900", fontSize: 18 },
  paymentSub: { textAlign: "right", color: palette.muted, marginTop: 3 },
  disabledBtn: { opacity: 0.6 },
});
