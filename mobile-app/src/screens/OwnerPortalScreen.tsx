import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SectionTitle } from "../components/SectionTitle";
import { gradients, palette } from "../theme";
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
  bookingDate: string;
  bookingTime: string | null;
  status: string;
};

type PaymentMethodCard = {
  code: "zain_cash" | "rafidain" | "nas_wallet" | "card";
  icon: string;
  label: string;
  value: string;
  isLink?: boolean;
};

export function OwnerPortalScreen({
  ownerUserId,
  onLogout,
}: {
  ownerUserId: string;
  onLogout: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [savingBookingId, setSavingBookingId] = useState<string | null>(null);
  const [ownerContext, setOwnerContext] = useState<OwnerContext | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<OwnerPaymentMethods>({
    zainCash: "",
    rafidain: "",
    nasWallet: "",
    cardUrl: "",
  });
  const [bookings, setBookings] = useState<OwnerBooking[]>([]);
  const [bookingEdits, setBookingEdits] = useState<Record<string, { date: string; time: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedPackageCode, setSelectedPackageCode] = useState(OWNER_PACKAGES[0].code);
  const [selectedPaymentCode, setSelectedPaymentCode] = useState<PaymentMethodCard["code"]>("zain_cash");

  const activePackage = getPackageByCode(subscription?.packageCode || null);
  const freeRemaining = Math.max(
    0,
    Number(ownerContext?.freeRequestsQuota || 0) - Number(ownerContext?.freeRequestsUsed || 0),
  );
  const subscriptionRemaining =
    subscription?.requestLimit === null
      ? null
      : Math.max(0, Number(subscription?.requestLimit || 0) - Number(subscription?.requestsUsed || 0));

  const methodsList = useMemo<PaymentMethodCard[]>(() => {
    const list: PaymentMethodCard[] = [];
    if (paymentMethods.zainCash) {
      list.push({ code: "zain_cash", icon: "🟢", label: "زين كاش", value: paymentMethods.zainCash });
    }
    if (paymentMethods.rafidain) {
      list.push({ code: "rafidain", icon: "🏦", label: "الرافدين", value: paymentMethods.rafidain });
    }
    if (paymentMethods.nasWallet) {
      list.push({ code: "nas_wallet", icon: "🟠", label: "ناس والت", value: paymentMethods.nasWallet });
    }
    list.push({
      code: "card",
      icon: "💳",
      label: "بطاقة Visa / MasterCard",
      value: paymentMethods.cardUrl || "سيتفعل رابط الدفع بالبطاقة قريباً",
      isLink: !!paymentMethods.cardUrl,
    });
    return list;
  }, [paymentMethods]);

  const selectedMethod = methodsList.find((item) => item.code === selectedPaymentCode) || methodsList[0] || null;

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const owner = await loadOwnerContext(ownerUserId);
      setOwnerContext(owner);
      const [sub, methods] = await Promise.all([
        loadLatestSubscription(owner.stationId),
        loadOwnerPaymentMethods(),
      ]);
      setSubscription(sub);
      setPaymentMethods(methods);
      if (sub?.id) {
        const pay = await loadPayments(sub.id);
        setPayments(pay);
      } else {
        setPayments([]);
      }

      const { data: bookingRows, error: bookingError } = await (supabase as any)
        .from("bookings")
        .select("id, booking_number, customer_name, booking_date, booking_time, status")
        .eq("station_id", owner.stationId)
        .order("created_at", { ascending: false })
        .limit(12);

      if (bookingError) throw bookingError;
      const normalizedBookings: OwnerBooking[] = (bookingRows || []).map((row: any) => ({
        id: row.id,
        bookingNumber: Number(row.booking_number || 0),
        customerName: row.customer_name || "عميل",
        bookingDate: row.booking_date || "",
        bookingTime: row.booking_time || null,
        status: row.status || "pending",
      }));
      setBookings(normalizedBookings);
      const edits: Record<string, { date: string; time: string }> = {};
      for (const booking of normalizedBookings) {
        edits[booking.id] = {
          date: booking.bookingDate,
          time: booking.bookingTime || "12:00 PM",
        };
      }
      setBookingEdits(edits);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل بوابة المحطة.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [ownerUserId]);

  useEffect(() => {
    if (!selectedMethod && methodsList.length > 0) {
      setSelectedPaymentCode(methodsList[0].code);
    }
  }, [methodsList, selectedMethod]);

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
        .update({
          booking_date: edit.date,
          booking_time: edit.time,
          status: "confirmed",
        })
        .eq("id", bookingId);
      if (updateError) throw updateError;
      setNotice("تم تعديل موعد الحجز بنجاح، وسيظهر التحديث مباشرة.");
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "تعذر تعديل الموعد.");
    } finally {
      setSavingBookingId(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={gradients.owner} style={styles.hero}>
        <Text style={styles.heroBadge}>Station Portal</Text>
        <Text style={styles.heroTitle}>بوابة المحطة</Text>
        <Text style={styles.heroText}>
          صاحب المحطة يراجع الرصيد والطلبات، ويختار باقة ثم يرسل طلب التفعيل للإدارة.
        </Text>
        <View style={styles.heroButtons}>
          <Pressable style={styles.lightBtn} onPress={refresh}>
            <Text style={styles.lightBtnText}>{loading ? "جاري التحميل..." : "تحديث"}</Text>
          </Pressable>
          <Pressable style={styles.darkBtn} onPress={onLogout}>
            <Text style={styles.darkBtnText}>تسجيل الخروج</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={palette.deepBlue} />
          <Text style={styles.loadingText}>جاري تحميل بيانات المحطة...</Text>
        </View>
      ) : null}

      {error ? <Notice text={error} kind="error" /> : null}
      {notice ? <Notice text={notice} kind="success" /> : null}

      {ownerContext ? (
        <>
          <SectionTitle title="ملخص المحطة" subtitle="الحالة الحالية للظهور والرصيد." />
          <View style={styles.grid}>
            <StatCard
              title="المحطة"
              value={ownerContext.stationName}
              small={ownerContext.stationIsActive ? "ظاهرة في الخريطة" : "متوقفة حالياً"}
            />
            <StatCard title="المجاني المتبقي" value={`${freeRemaining}`} small="طلبات متبقية" />
            <StatCard
              title="الباقة الحالية"
              value={activePackage?.title || "لا توجد"}
              small={subscription?.status || "غير مفعلة"}
            />
            <StatCard
              title="رصيد الباقة"
              value={subscriptionRemaining === null ? "غير محدود" : `${subscriptionRemaining}`}
              small="طلبات متبقية"
            />
          </View>

          <SectionTitle title="اختيار الباقة" subtitle="اضغط على الباقة ثم اختر طريقة الدفع وأرسل الطلب للإدارة." />
          <View style={styles.packageIconGrid}>
            {OWNER_PACKAGES.map((pkg) => {
              const selected = pkg.code === selectedPackageCode;
              return (
                <Pressable
                  key={pkg.code}
                  style={[styles.packageIcon, selected && styles.packageIconActive]}
                  onPress={() => setSelectedPackageCode(pkg.code)}
                >
                  <Text style={styles.packageIconEmoji}>
                    {pkg.requestLimit === null ? "♾️" : pkg.requestLimit <= 20 ? "🚀" : pkg.requestLimit <= 50 ? "⭐" : "🏆"}
                  </Text>
                  <Text style={[styles.packageIconTitle, selected && styles.packageIconTitleActive]}>{pkg.title}</Text>
                  <Text style={[styles.packageIconPrice, selected && styles.packageIconTitleActive]}>${pkg.priceUsd}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>طريقة الدفع</Text>
            <Text style={styles.cardSub}>صاحب المحطة لا يفعّل الباقة بنفسه. يتم التفعيل من الإدارة بعد استلام الدفع.</Text>
            <View style={styles.paymentMethodGrid}>
              {methodsList.map((method) => {
                const active = method.code === selectedPaymentCode;
                return (
                  <Pressable
                    key={method.code}
                    style={[styles.methodChip, active && styles.methodChipActive]}
                    onPress={() => setSelectedPaymentCode(method.code)}
                  >
                    <Text style={styles.methodChipIcon}>{method.icon}</Text>
                    <Text style={[styles.methodChipText, active && styles.methodChipTextActive]}>{method.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedMethod ? (
              <View style={styles.methodDetails}>
                <Text style={styles.methodTitle}>{selectedMethod.label}</Text>
                <Text style={styles.methodValue}>{selectedMethod.value}</Text>
                {selectedMethod.isLink ? (
                  <Pressable
                    style={styles.openLinkBtn}
                    onPress={async () => {
                      const canOpen = await Linking.canOpenURL(selectedMethod.value);
                      if (!canOpen) {
                        Alert.alert("تنبيه", "لا يمكن فتح رابط الدفع حالياً.");
                        return;
                      }
                      await Linking.openURL(selectedMethod.value);
                    }}
                  >
                    <Text style={styles.openLinkBtnText}>فتح رابط الدفع بالبطاقة</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          <SectionTitle title="إشعارات داخل التطبيق" subtitle="آخر الحجوزات القادمة للمحطة مع إمكانية تعديل الوقت." />
          <View style={styles.card}>
            {bookings.length === 0 ? (
              <Text style={styles.cardSub}>لا توجد حجوزات حالياً.</Text>
            ) : (
              bookings.map((booking) => (
                <View key={booking.id} style={styles.bookingRow}>
                  <Text style={styles.bookingTitle}>
                    #{booking.bookingNumber} - {booking.customerName}
                  </Text>
                  <Text style={styles.bookingSub}>الحالة: {booking.status}</Text>
                  <View style={styles.bookingEditRow}>
                    <TextInput
                      value={bookingEdits[booking.id]?.date || ""}
                      onChangeText={(value) =>
                        setBookingEdits((prev) => ({ ...prev, [booking.id]: { ...prev[booking.id], date: value } }))
                      }
                      placeholder="YYYY-MM-DD"
                      style={styles.bookingInput}
                      textAlign="center"
                    />
                    <TextInput
                      value={bookingEdits[booking.id]?.time || ""}
                      onChangeText={(value) =>
                        setBookingEdits((prev) => ({ ...prev, [booking.id]: { ...prev[booking.id], time: value } }))
                      }
                      placeholder="hh:mm AM"
                      style={styles.bookingInput}
                      textAlign="center"
                    />
                    <Pressable
                      style={[styles.bookingSaveBtn, savingBookingId === booking.id && styles.disabledBtn]}
                      onPress={() => updateBookingTime(booking.id)}
                      disabled={savingBookingId === booking.id}
                    >
                      {savingBookingId === booking.id ? (
                        <ActivityIndicator size="small" color={palette.white} />
                      ) : (
                        <Text style={styles.bookingSaveBtnText}>تعديل الوقت</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          <SectionTitle title="آخر الدفعات" subtitle="سجل الدفعات المرتبط بالاشتراك الحالي." />
          <View style={styles.card}>
            {payments.length === 0 ? (
              <Text style={styles.cardSub}>لا توجد دفعات مسجلة بعد.</Text>
            ) : (
              payments.map((payment) => (
                <View key={payment.id} style={styles.paymentRow}>
                  <Text style={styles.paymentMain}>${payment.amount}</Text>
                  <Text style={styles.paymentSub}>
                    {payment.status} • {payment.method || "manual"} • {payment.paymentDate?.slice(0, 10) || "--"}
                  </Text>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function StatCard({ title, value, small }: { title: string; value: string; small: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSmall}>{small}</Text>
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
  screen: { flex: 1, backgroundColor: palette.sand },
  content: { padding: 18, paddingBottom: 40 },
  hero: { borderRadius: 24, padding: 20, marginBottom: 16 },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.15)",
    color: palette.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "700",
  },
  heroTitle: { textAlign: "right", color: palette.white, fontWeight: "900", fontSize: 30, marginTop: 8 },
  heroText: { textAlign: "right", color: "rgba(255,255,255,0.84)", lineHeight: 22, marginTop: 8 },
  heroButtons: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  lightBtn: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  lightBtnText: { color: palette.deepBlue, fontWeight: "800" },
  darkBtn: {
    flex: 1,
    borderRadius: 12,
    borderColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  darkBtnText: { color: palette.white, fontWeight: "800" },
  loadingCard: {
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 14,
    borderColor: palette.line,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: 14,
  },
  loadingText: { color: palette.muted, marginTop: 8 },
  notice: { borderRadius: 14, padding: 12, marginBottom: 12 },
  noticeSuccess: { backgroundColor: "#e8f6ee", borderColor: "#c8e9d3", borderWidth: 1 },
  noticeError: { backgroundColor: "#fff2f2", borderColor: "#f3c4c4", borderWidth: 1 },
  noticeText: { textAlign: "right", lineHeight: 20, color: palette.text, fontWeight: "700" },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 12 },
  statCard: {
    width: "48.5%",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderWidth: 1,
  },
  statTitle: { textAlign: "right", color: palette.muted, fontSize: 12 },
  statValue: { textAlign: "right", color: palette.deepBlue, fontSize: 23, fontWeight: "900", marginTop: 4 },
  statSmall: { textAlign: "right", color: palette.text, marginTop: 2, fontSize: 12 },
  packageIconGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  packageIcon: {
    width: "48%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  packageIconActive: { borderColor: palette.brightBlue, backgroundColor: "#eaf3fb" },
  packageIconEmoji: { fontSize: 22, marginBottom: 6 },
  packageIconTitle: { color: palette.text, fontWeight: "800", textAlign: "center" },
  packageIconTitleActive: { color: palette.deepBlue },
  packageIconPrice: { color: palette.deepBlue, fontWeight: "900", marginTop: 4, fontSize: 18 },
  card: {
    borderRadius: 16,
    borderColor: palette.line,
    borderWidth: 1,
    backgroundColor: palette.white,
    padding: 12,
    marginBottom: 14,
  },
  cardTitle: { textAlign: "right", color: palette.text, fontWeight: "800" },
  cardSub: { textAlign: "right", color: palette.muted, lineHeight: 22, marginTop: 6 },
  paymentMethodGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 10 },
  methodChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#f8fbfe",
  },
  methodChipActive: { borderColor: palette.brightBlue, backgroundColor: "#eaf3fb" },
  methodChipIcon: { fontSize: 14 },
  methodChipText: { color: palette.text, fontWeight: "700", fontSize: 12 },
  methodChipTextActive: { color: palette.deepBlue },
  methodDetails: { marginTop: 12, borderTopWidth: 1, borderColor: palette.line, paddingTop: 10 },
  methodTitle: { textAlign: "right", color: palette.deepBlue, fontWeight: "900" },
  methodValue: { textAlign: "right", color: palette.text, marginTop: 4, lineHeight: 20 },
  openLinkBtn: {
    marginTop: 10,
    alignSelf: "flex-end",
    backgroundColor: palette.deepBlue,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  openLinkBtnText: { color: palette.white, fontWeight: "800" },
  bookingRow: {
    borderBottomWidth: 1,
    borderColor: palette.line,
    paddingBottom: 10,
    marginBottom: 10,
  },
  bookingTitle: { textAlign: "right", color: palette.text, fontWeight: "900" },
  bookingSub: { textAlign: "right", color: palette.muted, marginTop: 2 },
  bookingEditRow: { flexDirection: "row-reverse", gap: 8, marginTop: 10, alignItems: "center" },
  bookingInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 10,
    backgroundColor: "#f8fbfe",
    paddingVertical: 9,
    paddingHorizontal: 8,
    color: palette.text,
  },
  bookingSaveBtn: {
    backgroundColor: palette.deepBlue,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  bookingSaveBtnText: { color: palette.white, fontWeight: "800", fontSize: 12 },
  disabledBtn: { opacity: 0.6 },
  paymentRow: { borderColor: palette.line, borderBottomWidth: 1, paddingBottom: 8, marginBottom: 8 },
  paymentMain: { textAlign: "right", color: palette.deepBlue, fontWeight: "900", fontSize: 18 },
  paymentSub: { textAlign: "right", color: palette.muted, marginTop: 3 },
});
