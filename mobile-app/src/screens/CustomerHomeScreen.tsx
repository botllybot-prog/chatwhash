import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MapView, { Marker, type Region } from "react-native-maps";
import { SectionTitle } from "../components/SectionTitle";
import { useStations } from "../hooks/useStations";
import { gradients, palette } from "../theme";
import {
  cancelMapBooking,
  createMapBooking,
  createQuickBooking,
  fetchBookedSlots,
  generateSlots,
  getLocalTodayISODate,
  getNextDays,
  spinBookingDiscount,
} from "../lib/bookingApi";
import type { BookingCreateResult, SpinResult } from "../types";

type Mode = "home" | "map" | "stations";

const DATE_OPTIONS = getNextDays(7);
const SPIN_SEGMENTS = [0, 5, 10, 15];

function formatCurrency(value: number) {
  return `${value.toLocaleString("en-US")} د.ع`;
}

function getNextHalfHourTime() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.ceil((minutes + 1) / 30) * 30;
  const safe = rounded % (24 * 60);
  const hour = `${Math.floor(safe / 60)}`.padStart(2, "0");
  const minute = `${safe % 60}`.padStart(2, "0");
  return `${hour}:${minute}`;
}

export function CustomerHomeScreen({
  onOpenOwner,
  onOpenMap,
  mode = "home",
}: {
  onOpenOwner: () => void;
  onOpenMap: () => void;
  mode?: Mode;
}) {
  const { stations, loading, error, reload, mapRegion } = useStations();
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(DATE_OPTIONS[0]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [needsRespin, setNeedsRespin] = useState(false);
  const [spinLoading, setSpinLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState<BookingCreateResult | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | "info">("info");
  const [customerRegion, setCustomerRegion] = useState<Region | null>(null);

  const selectedStation = useMemo(
    () => stations.find((station) => station.id === selectedStationId) || null,
    [stations, selectedStationId],
  );
  const selectedService = useMemo(
    () => selectedStation?.services.find((service) => service.id === selectedServiceId) || null,
    [selectedStation, selectedServiceId],
  );
  const quickTime = selectedSlot || getNextHalfHourTime();
  const activeRegion = customerRegion || mapRegion;
  const discountAmount =
    selectedService && spinResult ? (selectedService.price * spinResult.discountPercent) / 100 : 0;
  const finalPrice = selectedService ? selectedService.price - discountAmount : 0;

  useEffect(() => {
    if (stations.length === 0) {
      setSelectedStationId(null);
      setSelectedServiceId(null);
      return;
    }
    if (!selectedStationId || !stations.some((station) => station.id === selectedStationId)) {
      setSelectedStationId(stations[0].id);
    }
  }, [selectedStationId, stations]);

  useEffect(() => {
    if (!selectedStation) return;
    setSelectedServiceId(selectedStation.services[0]?.id || null);
  }, [selectedStation?.id]);

  useEffect(() => {
    if (!selectedStation || selectedStation.schedulingType !== "slots") {
      setAvailableSlots([]);
      setSelectedSlot(null);
      return;
    }

    let mounted = true;
    const loadSlots = async () => {
      setSlotsLoading(true);
      try {
        const blocked = await fetchBookedSlots(selectedStation.id, selectedDate);
        const slots = generateSlots(selectedStation, selectedDate, blocked);
        if (!mounted) return;
        setAvailableSlots(slots);
        setSelectedSlot((current) => (current && slots.includes(current) ? current : slots[0] || null));
      } catch (slotError) {
        if (!mounted) return;
        setAvailableSlots([]);
        setSelectedSlot(null);
        showNotice(slotError instanceof Error ? slotError.message : "تعذر تحميل أوقات الحجز.", "error");
      } finally {
        if (mounted) setSlotsLoading(false);
      }
    };

    loadSlots();
    return () => {
      mounted = false;
    };
  }, [selectedDate, selectedStation]);

  useEffect(() => {
    setSpinResult(null);
    setNeedsRespin(false);
    setBookingResult(null);
  }, [selectedStation?.id, selectedService?.id, selectedDate, selectedSlot, customerPhone.trim()]);

  const titleByMode: Record<Mode, string> = {
    home: "احجز من الخريطة بخطوات بسيطة",
    map: "الخريطة المباشرة للمحطات المتاحة",
    stations: "المحطات والخدمات المتاحة الآن",
  };

  const canSpin =
    !!selectedStation &&
    !!selectedService &&
    !!customerName.trim() &&
    !!customerPhone.trim() &&
    (selectedStation.schedulingType !== "slots" || !!selectedSlot);

  const canConfirm = canSpin && !!spinResult?.token && !bookingLoading && !spinLoading && !slotsLoading;

  const showNotice = (message: string, type: "success" | "error" | "info") => {
    setFeedback(message);
    setFeedbackType(type);
  };

  const locateCustomer = async () => {
    const Location = await import("expo-location");
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      throw new Error("فعّل إذن الموقع حتى يعمل الحجز السريع والخريطة بدقة.");
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const nextRegion = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
    setCustomerRegion(nextRegion);
    return nextRegion;
  };

  const handleQuickBooking = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      showNotice("أدخل اسم الزبون ورقم الهاتف قبل إرسال الحجز السريع.", "info");
      return;
    }

    setQuickLoading(true);
    try {
      const location = customerRegion || (await locateCustomer());
      const result = await createQuickBooking({
        customerName,
        customerPhone,
        bookingDate: selectedDate,
        bookingTime: quickTime,
        customerLatitude: location.latitude,
        customerLongitude: location.longitude,
      });
      const count = result.target_count || result.targets?.length || 0;
      showNotice(`تم إرسال الحجز السريع إلى ${count} محطة ضمن نطاقك. سنبلغك عند رد المحطات.`, "success");
      await reload();
    } catch (quickError) {
      showNotice(quickError instanceof Error ? quickError.message : "تعذر إرسال الحجز السريع.", "error");
    } finally {
      setQuickLoading(false);
    }
  };

  const handleSpin = async () => {
    if (!selectedStation || !selectedService) return;
    if (!canSpin) {
      showNotice("أكمل بيانات الحجز أولاً: الخدمة، الوقت، الاسم، والهاتف.", "info");
      return;
    }

    setSpinLoading(true);
    try {
      const spin = await spinBookingDiscount({
        stationId: selectedStation.id,
        serviceId: selectedService.id,
        bookingDate: selectedDate,
        bookingTime: selectedStation.schedulingType === "slots" ? selectedSlot : null,
        customerPhone,
      });

      if (spin.requiresRespin) {
        setNeedsRespin(true);
        setSpinResult(null);
        showNotice("ظهرت لك محاولة إضافية. اضغط زر العجلة مرة ثانية.", "info");
        return;
      }

      if (!spin.result) {
        showNotice("تعذر تثبيت نتيجة عجلة الخصم. حاول مرة أخرى.", "error");
        return;
      }

      setNeedsRespin(false);
      setSpinResult(spin.result);
      showNotice(`تم تثبيت خصم ${spin.result.discountPercent}% لهذا الحجز.`, "success");
    } catch (spinError) {
      showNotice(spinError instanceof Error ? spinError.message : "فشل تدوير عجلة الخصم.", "error");
    } finally {
      setSpinLoading(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedStation || !selectedService || !spinResult) return;
    if (!canConfirm) {
      showNotice("لا يمكن تأكيد الحجز قبل إكمال الخطوات وتثبيت نتيجة العجلة.", "info");
      return;
    }

    setBookingLoading(true);
    try {
      const result = await createMapBooking({
        stationId: selectedStation.id,
        serviceId: selectedService.id,
        customerName,
        customerPhone,
        bookingDate: selectedDate,
        bookingTime: selectedStation.schedulingType === "slots" ? selectedSlot : null,
        spinDiscountPercent: spinResult.discountPercent,
        spinToken: spinResult.token,
      });

      setBookingResult(result);
      showNotice(`تم إرسال طلب الحجز بنجاح (#${result.bookingNumber}).`, "success");
    } catch (bookingError) {
      showNotice(bookingError instanceof Error ? bookingError.message : "تعذر تأكيد الحجز.", "error");
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!bookingResult) return;
    setCancelLoading(true);
    try {
      await cancelMapBooking(bookingResult.bookingId, customerPhone);
      setBookingResult(null);
      setSpinResult(null);
      setNeedsRespin(false);
      showNotice("تم إلغاء الحجز بنجاح.", "success");
      await reload();
    } catch (cancelError) {
      showNotice(cancelError instanceof Error ? cancelError.message : "تعذر إلغاء الحجز.", "error");
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={gradients.hero} style={styles.heroCard}>
        <Text style={styles.heroBadge}>Washlly Mobile</Text>
        <Text style={styles.heroTitle}>{titleByMode[mode]}</Text>
        <View style={styles.heroActions}>
          <Pressable style={styles.primaryButton} onPress={onOpenMap}>
            <Text style={styles.primaryButtonText}>إظهار الخريطة</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onOpenOwner}>
            <Text style={styles.secondaryButtonText}>دخول المحطة</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {error ? <NoticeBox title="تنبيه اتصال" text={error} kind="error" /> : null}
      {feedback ? (
        <NoticeBox
          title={feedbackType === "success" ? "تمت العملية" : feedbackType === "error" ? "حدث خطأ" : "معلومة"}
          text={feedback}
          kind={feedbackType}
        />
      ) : null}

      <SectionTitle title="الخريطة والحجز السريع" subtitle="حدد موقعك ثم أرسل طلباً لأقرب 3 محطات ضمن نطاقك." />
      <View style={styles.mapWrap}>
        <MapView style={StyleSheet.absoluteFill} initialRegion={mapRegion} region={activeRegion}>
          {stations.map((station) => (
            <Marker
              key={station.id}
              coordinate={{ latitude: station.latitude, longitude: station.longitude }}
              title={station.name}
              description={`${station.area} • ${station.open ? "مفتوح" : "مغلق"}`}
              onPress={() => setSelectedStationId(station.id)}
            />
          ))}
          {customerRegion ? (
            <Marker
              coordinate={{ latitude: customerRegion.latitude, longitude: customerRegion.longitude }}
              title="موقعي"
              pinColor="#1d4ed8"
            />
          ) : null}
        </MapView>
        <View style={styles.mapOverlay}>
          <Text style={styles.mapOverlayTitle}>الخريطة جاهزة للحجز السريع</Text>
          <Text style={styles.mapOverlayText}>وقت الحجز السريع الحالي: {selectedDate} - {quickTime}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Field label="اسم الزبون" value={customerName} onChangeText={setCustomerName} placeholder="مصطفى" />
        <Field label="رقم الهاتف" value={customerPhone} onChangeText={setCustomerPhone} placeholder="0773XXXXXXX" />
        <View style={styles.actionsRow}>
          <Pressable style={styles.locateButton} onPress={() => locateCustomer().catch((err) => Alert.alert("الموقع", err.message))}>
            <Text style={styles.locateButtonText}>تحديد موقعي</Text>
          </Pressable>
          <Pressable
            style={[styles.quickButton, quickLoading && styles.disabledButton]}
            onPress={handleQuickBooking}
            disabled={quickLoading}
          >
            {quickLoading ? <ActivityIndicator color={palette.white} /> : <Text style={styles.quickButtonText}>حجز سريع لأقرب 3 محطات</Text>}
          </Pressable>
        </View>
      </View>

      <SectionTitle title="1) اختر المحطة" subtitle="اختيار محطة محددة يستخدم للحجز الاعتيادي من الخريطة." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
        {stations.map((station) => {
          const active = station.id === selectedStation?.id;
          return (
            <Pressable key={station.id} onPress={() => setSelectedStationId(station.id)} style={[styles.stationChip, active && styles.stationChipActive]}>
              <Text style={[styles.stationChipName, active && styles.stationChipNameActive]}>{station.name}</Text>
              <Text style={[styles.stationChipMeta, active && styles.stationChipMetaActive]}>
                {station.area} • {station.open ? "مفتوح" : "مغلق"}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {selectedStation ? (
        <>
          <SectionTitle title="2) اختر الخدمة" subtitle="اختر خدمة واحدة لتثبيت السعر والخصم." />
          <View style={styles.cardsColumn}>
            {selectedStation.services.map((service) => {
              const active = service.id === selectedService?.id;
              return (
                <Pressable key={service.id} style={[styles.serviceCard, active && styles.serviceCardActive]} onPress={() => setSelectedServiceId(service.id)}>
                  <Text style={[styles.serviceName, active && styles.serviceNameActive]}>{service.name}</Text>
                  <Text style={[styles.serviceMeta, active && styles.serviceMetaActive]}>
                    {formatCurrency(service.price)} • {service.durationMinutes} دقيقة
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <SectionTitle title="3) اختر اليوم والوقت" subtitle="اليوم الحالي يعرض الأوقات اللاحقة فقط." />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {DATE_OPTIONS.map((date) => {
              const active = date === selectedDate;
              return (
                <Pressable key={date} style={[styles.dateChip, active && styles.dateChipActive]} onPress={() => setSelectedDate(date)}>
                  <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{date}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedStation.schedulingType === "slots" ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>الأوقات المتاحة</Text>
              {slotsLoading ? (
                <ActivityIndicator color={palette.deepBlue} />
              ) : availableSlots.length > 0 ? (
                <View style={styles.slotWrap}>
                  {availableSlots.map((slot) => {
                    const active = slot === selectedSlot;
                    return (
                      <Pressable key={slot} style={[styles.slotChip, active && styles.slotChipActive]} onPress={() => setSelectedSlot(slot)}>
                        <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.cardSubText}>لا توجد أوقات متاحة في هذا اليوم.</Text>
              )}
            </View>
          ) : null}

          <SectionTitle title="4) عجلة الخصم" subtitle="الخصومات المتاحة: 0%، 5%، 10%، 15%." />
          <View style={styles.spinCard}>
            <View style={styles.wheelWrap}>
              <View style={styles.pointer} />
              <View style={styles.wheel}>
                {SPIN_SEGMENTS.map((segment, index) => (
                  <View key={segment} style={[styles.wheelSegment, index % 2 === 0 ? styles.wheelSegmentA : styles.wheelSegmentB]}>
                    <Text style={styles.wheelSegmentText}>{segment}%</Text>
                  </View>
                ))}
                <View style={styles.wheelCenter}>
                  <Text style={styles.wheelCenterText}>{spinResult ? `${spinResult.discountPercent}%` : "خصم"}</Text>
                </View>
              </View>
            </View>
            <View style={styles.spinPriceBox}>
              <Text style={styles.spinResultLabel}>السعر النهائي</Text>
              <Text style={styles.spinResultValue}>{selectedService ? formatCurrency(finalPrice) : "--"}</Text>
              {selectedService ? <Text style={styles.spinSubText}>قبل الخصم: {formatCurrency(selectedService.price)}</Text> : null}
            </View>
            <Pressable style={[styles.spinButton, (!canSpin || spinLoading) && styles.disabledButton]} onPress={handleSpin} disabled={!canSpin || spinLoading}>
              {spinLoading ? <ActivityIndicator color={palette.white} /> : <Text style={styles.spinButtonText}>{needsRespin ? "أعد تدوير العجلة" : "لف عجلة الخصم"}</Text>}
            </Pressable>
          </View>

          <SectionTitle title="5) تأكيد أو إلغاء" subtitle="بعد التدوير يمكنك إرسال الحجز الاعتيادي للمحطة المحددة." />
          <View style={styles.card}>
            {bookingResult ? (
              <Text style={styles.bookingInfo}>رقم الحجز الحالي: #{bookingResult.bookingNumber}</Text>
            ) : (
              <Text style={styles.cardSubText}>أكمل الخطوات السابقة ثم اضغط تأكيد الحجز.</Text>
            )}
            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.confirmButton, (!canConfirm || bookingLoading || !!bookingResult) && styles.disabledButton]}
                onPress={handleConfirmBooking}
                disabled={!canConfirm || bookingLoading || !!bookingResult}
              >
                {bookingLoading ? <ActivityIndicator color={palette.white} /> : <Text style={styles.confirmButtonText}>تأكيد الحجز</Text>}
              </Pressable>
              <Pressable
                style={[styles.cancelButton, (!bookingResult || cancelLoading) && styles.disabledButton]}
                onPress={handleCancelBooking}
                disabled={!bookingResult || cancelLoading}
              >
                {cancelLoading ? <ActivityIndicator color={palette.deepBlue} /> : <Text style={styles.cancelButtonText}>إلغاء الحجز</Text>}
              </Pressable>
            </View>
          </View>
        </>
      ) : loading ? (
        <ActivityIndicator color={palette.deepBlue} />
      ) : null}
    </ScrollView>
  );
}

function NoticeBox({
  title,
  text,
  kind,
}: {
  title: string;
  text: string;
  kind: "success" | "error" | "info";
}) {
  const style =
    kind === "success"
      ? { backgroundColor: "#e8f6ee", borderColor: "#c8e9d3", textColor: "#1f6f46" }
      : kind === "error"
      ? { backgroundColor: "#fff2f2", borderColor: "#f3c4c4", textColor: "#8b2d2d" }
      : { backgroundColor: "#eef5ff", borderColor: "#cadef5", textColor: "#22466d" };

  return (
    <View style={[styles.noticeBox, { backgroundColor: style.backgroundColor, borderColor: style.borderColor }]}>
      <Text style={[styles.noticeTitle, { color: style.textColor }]}>{title}</Text>
      <Text style={[styles.noticeText, { color: style.textColor }]}>{text}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8aa0b8" style={styles.input} textAlign="right" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.sand },
  content: { padding: 18, paddingBottom: 36 },
  heroCard: { borderRadius: 24, padding: 20, marginBottom: 16 },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: palette.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "700",
    marginBottom: 8,
  },
  heroTitle: { fontSize: 28, lineHeight: 34, color: palette.white, fontWeight: "900", textAlign: "right" },
  heroActions: { flexDirection: "row-reverse", marginTop: 14, gap: 8 },
  primaryButton: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  primaryButtonText: { color: palette.deepBlue, fontWeight: "800" },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderColor: "rgba(255,255,255,0.3)",
    borderWidth: 1,
  },
  secondaryButtonText: { color: palette.white, fontWeight: "700" },
  noticeBox: { borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 14 },
  noticeTitle: { textAlign: "right", fontWeight: "800", marginBottom: 6 },
  noticeText: { textAlign: "right", lineHeight: 20 },
  mapWrap: {
    height: 300,
    borderRadius: 20,
    overflow: "hidden",
    borderColor: palette.line,
    borderWidth: 1,
    marginBottom: 12,
  },
  mapOverlay: {
    position: "absolute",
    right: 10,
    left: 10,
    bottom: 10,
    borderRadius: 14,
    backgroundColor: "rgba(10,22,38,0.84)",
    padding: 12,
  },
  mapOverlayTitle: { color: palette.white, textAlign: "right", fontWeight: "800", marginBottom: 4 },
  mapOverlayText: { color: "rgba(255,255,255,0.84)", textAlign: "right", fontSize: 12, lineHeight: 18 },
  horizontalList: { gap: 8, paddingBottom: 8 },
  stationChip: {
    width: 200,
    borderRadius: 14,
    borderColor: palette.line,
    borderWidth: 1,
    backgroundColor: palette.white,
    padding: 12,
  },
  stationChipActive: { borderColor: palette.brightBlue, backgroundColor: "#eaf3fb" },
  stationChipName: { textAlign: "right", color: palette.text, fontWeight: "800", marginBottom: 5 },
  stationChipNameActive: { color: palette.deepBlue },
  stationChipMeta: { textAlign: "right", color: palette.muted, fontSize: 12 },
  stationChipMetaActive: { color: palette.deepBlue },
  cardsColumn: { marginBottom: 14 },
  serviceCard: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  serviceCardActive: { borderColor: palette.brightBlue, backgroundColor: "#eaf3fb" },
  serviceName: { textAlign: "right", color: palette.text, fontWeight: "800" },
  serviceNameActive: { color: palette.deepBlue },
  serviceMeta: { textAlign: "right", color: palette.muted, marginTop: 4 },
  serviceMetaActive: { color: palette.deepBlue },
  dateChip: {
    borderRadius: 999,
    borderColor: palette.line,
    borderWidth: 1,
    backgroundColor: palette.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dateChipActive: { backgroundColor: palette.deepBlue, borderColor: palette.deepBlue },
  dateChipText: { color: palette.text, fontWeight: "700" },
  dateChipTextActive: { color: palette.white },
  card: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  cardTitle: { textAlign: "right", color: palette.text, fontWeight: "800", marginBottom: 8 },
  cardSubText: { textAlign: "right", color: palette.muted, lineHeight: 20 },
  slotWrap: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  slotChip: {
    borderRadius: 999,
    borderColor: palette.line,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#f9fbff",
  },
  slotChipActive: { backgroundColor: palette.deepBlue, borderColor: palette.deepBlue },
  slotText: { color: palette.text, fontWeight: "700" },
  slotTextActive: { color: palette.white },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { textAlign: "right", color: palette.text, fontWeight: "700", marginBottom: 6 },
  input: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: "#f8fbfe",
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: palette.text,
  },
  spinCard: { backgroundColor: "#10233f", borderRadius: 18, padding: 14, marginBottom: 14 },
  wheelWrap: { alignItems: "center", marginBottom: 12 },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 18,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: palette.gold,
    marginBottom: -2,
    zIndex: 2,
  },
  wheel: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 8,
    borderColor: palette.white,
    overflow: "hidden",
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: palette.deepBlue,
  },
  wheelSegment: { width: "50%", height: "50%", alignItems: "center", justifyContent: "center" },
  wheelSegmentA: { backgroundColor: "#1f9f8f" },
  wheelSegmentB: { backgroundColor: "#f59e0b" },
  wheelSegmentText: { color: palette.white, fontWeight: "900", fontSize: 20 },
  wheelCenter: {
    position: "absolute",
    top: 58,
    left: 58,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: palette.white,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelCenterText: { color: palette.deepBlue, fontWeight: "900" },
  spinPriceBox: { borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)", padding: 10, marginBottom: 10 },
  spinResultLabel: { textAlign: "right", color: "rgba(255,255,255,0.78)", fontSize: 12 },
  spinResultValue: { textAlign: "right", color: palette.white, fontWeight: "900", fontSize: 22, marginTop: 4 },
  spinSubText: { textAlign: "right", color: "rgba(255,255,255,0.72)", marginTop: 4, fontSize: 12 },
  spinButton: { backgroundColor: palette.gold, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  spinButtonText: { color: "#2f2a17", fontWeight: "900" },
  actionsRow: { flexDirection: "row-reverse", gap: 8, marginTop: 10 },
  quickButton: { flex: 1.2, backgroundColor: palette.deepBlue, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  quickButtonText: { color: palette.white, fontWeight: "800", textAlign: "center" },
  locateButton: {
    flex: 0.8,
    backgroundColor: "#f0f4f8",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderColor: palette.line,
    borderWidth: 1,
  },
  locateButtonText: { color: palette.deepBlue, fontWeight: "800" },
  confirmButton: { flex: 1, backgroundColor: palette.deepBlue, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  confirmButtonText: { color: palette.white, fontWeight: "800" },
  cancelButton: {
    flex: 1,
    backgroundColor: "#f0f4f8",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderColor: palette.line,
    borderWidth: 1,
  },
  cancelButtonText: { color: palette.deepBlue, fontWeight: "800" },
  bookingInfo: { textAlign: "right", color: palette.deepBlue, fontWeight: "800" },
  disabledButton: { opacity: 0.45 },
});
