import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MapView, { Marker } from "react-native-maps";
import { SectionTitle } from "../components/SectionTitle";
import { useStations } from "../hooks/useStations";
import { gradients, palette } from "../theme";
import {
  cancelMapBooking,
  createMapBooking,
  fetchBookedSlots,
  generateSlots,
  getLocalTodayISODate,
  getNextDays,
  spinBookingDiscount,
} from "../lib/bookingApi";
import type { BookingCreateResult, MobileService, SpinResult } from "../types";

type Mode = "home" | "map" | "stations";

const DATE_OPTIONS = getNextDays(7);

function extractGovernorate(area: string) {
  if (!area) return "غير محدد";
  const normalized = area.replace(/\s+/g, " ").trim();
  const firstPart = normalized.split("-")[0]?.split("،")[0]?.trim();
  return firstPart || "غير محدد";
}

function formatCurrency(value: number) {
  return `${value.toLocaleString("en-US")} د.ع`;
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
  const { stations, loading, source, error, reload, mapRegion } = useStations();
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
  const [cancelLoading, setCancelLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState<BookingCreateResult | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | "info">("info");
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>("الكل");

  const governorateOptions = useMemo(() => {
    const unique = Array.from(new Set(stations.map((station) => extractGovernorate(station.area))));
    return ["الكل", ...unique];
  }, [stations]);

  const visibleStations = useMemo(() => {
    if (selectedGovernorate === "الكل") return stations;
    return stations.filter((station) => extractGovernorate(station.area) === selectedGovernorate);
  }, [selectedGovernorate, stations]);

  const selectedStation = useMemo(
    () => visibleStations.find((station) => station.id === selectedStationId) || null,
    [visibleStations, selectedStationId],
  );
  const selectedService = useMemo(
    () =>
      selectedStation?.services.find((service) => service.id === selectedServiceId) || null,
    [selectedStation, selectedServiceId],
  );

  const discountAmount =
    selectedService && spinResult
      ? (selectedService.price * spinResult.discountPercent) / 100
      : 0;
  const finalPrice = selectedService ? selectedService.price - discountAmount : 0;

  useEffect(() => {
    if (visibleStations.length === 0) {
      setSelectedStationId(null);
      setSelectedServiceId(null);
      return;
    }
    if (!selectedStationId || !visibleStations.some((station) => station.id === selectedStationId)) {
      setSelectedStationId(visibleStations[0].id);
    }
  }, [selectedStationId, visibleStations]);

  useEffect(() => {
    if (!selectedStation) return;
    const defaultService = selectedStation.services[0];
    setSelectedServiceId(defaultService?.id || null);
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
        setFeedback(
          slotError instanceof Error
            ? slotError.message
            : "تعذر تحميل أوقات الحجز الحالية.",
        );
        setFeedbackType("error");
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
  }, [
    selectedStation?.id,
    selectedService?.id,
    selectedDate,
    selectedSlot,
    customerPhone.trim(),
  ]);

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

  const canConfirm =
    canSpin && !!spinResult?.token && !bookingLoading && !spinLoading && !slotsLoading;

  const showNotice = (message: string, type: "success" | "error" | "info") => {
    setFeedback(message);
    setFeedbackType(type);
  };

  const handleSpin = async () => {
    if (!selectedStation || !selectedService) return;
    if (!canSpin) {
      showNotice("أكمل بيانات الحجز أولاً (الخدمة، الوقت، الاسم، الهاتف).", "info");
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
        showNotice("تعذر تثبيت نتيجة العجلة. حاول مرة أخرى.", "error");
        return;
      }

      setNeedsRespin(false);
      setSpinResult(spin.result);
      showNotice(`تم تثبيت خصم ${spin.result.discountPercent}% لهذا الحجز.`, "success");
    } catch (spinError) {
      showNotice(
        spinError instanceof Error ? spinError.message : "فشل تدوير عجلة الخصم.",
        "error",
      );
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
      showNotice(
        `تم إرسال طلب الحجز بنجاح (#${result.bookingNumber}). سيتم إشعارك عبر واتساب بعد رد المحطة.`,
        "success",
      );
    } catch (bookingError) {
      showNotice(
        bookingError instanceof Error ? bookingError.message : "تعذر تأكيد الحجز.",
        "error",
      );
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
      setSelectedSlot(null);
      setCustomerName("");
      setCustomerPhone("");
      showNotice("تم إلغاء الحجز بنجاح وإعادة النموذج لحالة جديدة.", "success");
      await reload();
    } catch (cancelError) {
      showNotice(
        cancelError instanceof Error ? cancelError.message : "تعذر إلغاء الحجز.",
        "error",
      );
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={gradients.hero} style={styles.heroCard}>
        <Text style={styles.heroBadge}>Washlly Mobile</Text>
        <Text style={styles.heroTitle}>{titleByMode[mode]}</Text>
        <View style={styles.heroActions}>
          <Pressable style={styles.primaryButton} onPress={onOpenMap}>
            <Text style={styles.primaryButtonText}>إظهار الخارطة</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onOpenOwner}>
            <Text style={styles.secondaryButtonText}>دخول المحطة</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {error ? (
        <NoticeBox title="تنبيه اتصال" text={error} kind="error" />
      ) : null}
      {feedback ? (
        <NoticeBox
          title={feedbackType === "success" ? "تمت العملية" : feedbackType === "error" ? "حدث خطأ" : "معلومة"}
          text={feedback}
          kind={feedbackType}
        />
      ) : null}

      <SectionTitle title="فلتر المحافظات" subtitle="اختر محافظتك أو اعرض جميع المحطات." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
        {governorateOptions.map((governorate) => {
          const active = governorate === selectedGovernorate;
          return (
            <Pressable
              key={governorate}
              style={[styles.dateChip, active && styles.dateChipActive]}
              onPress={() => setSelectedGovernorate(governorate)}
            >
              <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{governorate}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {mode === "map" && (
        <>
          <SectionTitle title="الخريطة" subtitle="اختر المحطة التي تناسبك ثم أكمل الحجز بالأسفل." />
          <View style={styles.mapWrap}>
            <MapView style={StyleSheet.absoluteFill} initialRegion={mapRegion} region={mapRegion}>
              {visibleStations.map((station) => (
                <Marker
                  key={station.id}
                  coordinate={{ latitude: station.latitude, longitude: station.longitude }}
                  title={station.name}
                  description={`${station.area} • ${station.open ? "مفتوح" : "مغلق"}`}
                  onPress={() => setSelectedStationId(station.id)}
                />
              ))}
            </MapView>
            <View style={styles.mapOverlay}>
              <Text style={styles.mapOverlayTitle}>حدد المحطة من الخريطة أو من القائمة</Text>
              <Text style={styles.mapOverlayText}>
                بعد تحديد المحطة، انزل لأسفل لإكمال الخدمة والموعد وتأكيد الحجز.
              </Text>
            </View>
          </View>
        </>
      )}

      <SectionTitle title="1) اختر المحطة" subtitle="المحطة المحددة ستستخدم لكل خطوات الحجز." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
        {visibleStations.map((station) => {
          const active = station.id === selectedStation?.id;
          return (
            <Pressable
              key={station.id}
              onPress={() => setSelectedStationId(station.id)}
              style={[styles.stationChip, active && styles.stationChipActive]}
            >
              <Text style={[styles.stationChipName, active && styles.stationChipNameActive]}>
                {station.name}
              </Text>
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
                <Pressable
                  key={service.id}
                  style={[styles.serviceCard, active && styles.serviceCardActive]}
                  onPress={() => setSelectedServiceId(service.id)}
                >
                  <Text style={[styles.serviceName, active && styles.serviceNameActive]}>{service.name}</Text>
                  <Text style={[styles.serviceMeta, active && styles.serviceMetaActive]}>
                    {formatCurrency(service.price)} • {service.durationMinutes} دقيقة
                  </Text>
                  {service.customerDiscount ? (
                    <Text style={[styles.serviceDiscount, active && styles.serviceDiscountActive]}>
                      خصم ظاهر: {service.customerDiscount}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <SectionTitle
            title="3) اختر اليوم والوقت"
            subtitle="نعرض الأيام الحالية فقط، واليوم الحالي يعرض الأوقات اللاحقة فقط."
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {DATE_OPTIONS.map((date) => {
              const active = date === selectedDate;
              return (
                <Pressable
                  key={date}
                  style={[styles.dateChip, active && styles.dateChipActive]}
                  onPress={() => setSelectedDate(date)}
                >
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
                      <Pressable
                        key={slot}
                        style={[styles.slotChip, active && styles.slotChipActive]}
                        onPress={() => setSelectedSlot(slot)}
                      >
                        <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.cardSubText}>لا توجد أوقات متاحة في هذا اليوم.</Text>
              )}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardSubText}>
                نوع هذه المحطة لا يعتمد على سلوتات زمنية ثابتة، وسيتم اعتماد التاريخ المحدد.
              </Text>
            </View>
          )}

          <SectionTitle title="4) بيانات العميل" subtitle="أدخل الاسم ورقم الواتساب الذي سيستقبل الإشعارات." />
          <View style={styles.card}>
            <Field label="اسم العميل" value={customerName} onChangeText={setCustomerName} placeholder="مصطفى" />
            <Field
              label="رقم الواتساب"
              value={customerPhone}
              onChangeText={setCustomerPhone}
              placeholder="0773XXXXXXX"
            />
          </View>

          <SectionTitle title="5) عجلة الخصم" subtitle="يجب تدوير العجلة وتثبيت النتيجة قبل التأكيد." />
          <View style={styles.spinCard}>
            <View style={styles.spinRow}>
              <View style={styles.spinResultBox}>
                <Text style={styles.spinResultLabel}>النتيجة الحالية</Text>
                <Text style={styles.spinResultValue}>
                  {spinResult ? `${spinResult.discountPercent}%` : needsRespin ? "محاولة إضافية" : "—"}
                </Text>
              </View>
              <View style={styles.spinPriceBox}>
                <Text style={styles.spinResultLabel}>السعر النهائي</Text>
                <Text style={styles.spinResultValue}>
                  {selectedService ? formatCurrency(finalPrice) : "--"}
                </Text>
                {selectedService ? (
                  <Text style={styles.spinSubText}>
                    قبل الخصم: {formatCurrency(selectedService.price)}
                  </Text>
                ) : null}
              </View>
            </View>
            <Pressable
              style={[styles.spinButton, (!canSpin || spinLoading) && styles.disabledButton]}
              onPress={handleSpin}
              disabled={!canSpin || spinLoading}
            >
              {spinLoading ? (
                <ActivityIndicator color={palette.white} />
              ) : (
                <Text style={styles.spinButtonText}>
                  {needsRespin ? "أعد تدوير العجلة" : "لف عجلة الخصم"}
                </Text>
              )}
            </Pressable>
          </View>

          <SectionTitle title="6) تأكيد أو إلغاء" subtitle="بعد التأكيد أو الإلغاء، تبدأ عملية جديدة بسهولة." />
          <View style={styles.card}>
            {bookingResult ? (
              <Text style={styles.bookingInfo}>رقم الحجز الحالي: #{bookingResult.bookingNumber}</Text>
            ) : (
              <Text style={styles.cardSubText}>
                اكمل الخطوات السابقة ثم اضغط تأكيد الحجز من الخريطة.
              </Text>
            )}
            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.confirmButton, (!canConfirm || bookingLoading || !!bookingResult) && styles.disabledButton]}
                onPress={handleConfirmBooking}
                disabled={!canConfirm || bookingLoading || !!bookingResult}
              >
                {bookingLoading ? (
                  <ActivityIndicator color={palette.white} />
                ) : (
                  <Text style={styles.confirmButtonText}>تأكيد الحجز</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.cancelButton, (!bookingResult || cancelLoading) && styles.disabledButton]}
                onPress={handleCancelBooking}
                disabled={!bookingResult || cancelLoading}
              >
                {cancelLoading ? (
                  <ActivityIndicator color={palette.deepBlue} />
                ) : (
                  <Text style={styles.cancelButtonText}>إلغاء الحجز</Text>
                )}
              </Pressable>
            </View>
          </View>
        </>
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
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8aa0b8"
        style={styles.input}
        textAlign="right"
      />
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
  heroText: { color: "rgba(255,255,255,0.86)", lineHeight: 22, textAlign: "right", marginTop: 8 },
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
  statusRow: { marginTop: 10, flexDirection: "row-reverse", justifyContent: "space-between" },
  statusText: { color: "rgba(255,255,255,0.86)", fontSize: 12, fontWeight: "700" },
  noticeBox: { borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 14 },
  noticeTitle: { textAlign: "right", fontWeight: "800", marginBottom: 6 },
  noticeText: { textAlign: "right", lineHeight: 20 },
  mapWrap: {
    height: 280,
    borderRadius: 20,
    overflow: "hidden",
    borderColor: palette.line,
    borderWidth: 1,
    marginBottom: 18,
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
  stationChipActive: {
    borderColor: palette.brightBlue,
    backgroundColor: "#eaf3fb",
  },
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
  serviceDiscount: { textAlign: "right", color: palette.muted, marginTop: 3, fontSize: 12 },
  serviceDiscountActive: { color: palette.deepBlue },
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
  spinCard: {
    backgroundColor: "#0d1f3c",
    borderRadius: 18,
    padding: 12,
    marginBottom: 14,
  },
  spinRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 10 },
  spinResultBox: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 10,
  },
  spinPriceBox: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 10,
  },
  spinResultLabel: { textAlign: "right", color: "rgba(255,255,255,0.78)", fontSize: 12 },
  spinResultValue: { textAlign: "right", color: palette.white, fontWeight: "900", fontSize: 22, marginTop: 4 },
  spinSubText: { textAlign: "right", color: "rgba(255,255,255,0.72)", marginTop: 4, fontSize: 12 },
  spinButton: {
    backgroundColor: palette.gold,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  spinButtonText: { color: "#2f2a17", fontWeight: "900" },
  actionsRow: { flexDirection: "row-reverse", gap: 8, marginTop: 10 },
  confirmButton: {
    flex: 1,
    backgroundColor: palette.deepBlue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
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
