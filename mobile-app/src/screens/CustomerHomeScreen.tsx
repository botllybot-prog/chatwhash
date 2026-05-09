import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { WebView } from "react-native-webview";
import { useStations } from "../hooks/useStations";
import { gradients, palette } from "../theme";
import {
  cancelAllMapBookings,
  cancelMapBooking,
  createMapBooking,
  createQuickBooking,
  fetchBookedSlots,
  fetchCustomerBookings,
  generateSlots,
  getNextDays,
  spinBookingDiscount,
} from "../lib/bookingApi";
import type { BookingCreateResult, CustomerBookingStatus, MobileStation, SpinResult } from "../types";

type Mode = "home" | "map" | "stations";
type BookingMode = "quick" | "regular";

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

function distanceKm(from: { latitude: number; longitude: number } | null, station: MobileStation) {
  if (!from || !station.latitude || !station.longitude) return null;
  const radius = 6371;
  const dLat = ((station.latitude - from.latitude) * Math.PI) / 180;
  const dLng = ((station.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (station.latitude * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "المسافة تظهر بعد تحديد موقعك";
  return value >= 1 ? `${value.toFixed(1)} كم` : `${Math.round(value * 1000)} م`;
}

function statusLabel(status: string) {
  if (status === "confirmed") return "تمت الموافقة";
  if (status === "rejected") return "مرفوض";
  if (status === "proposed_time") return "وقت بديل";
  if (status === "cancelled") return "ملغي";
  return "بانتظار الرد";
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
  const { stations, loading, error, reload } = useStations();
  const [bookingMode, setBookingMode] = useState<BookingMode>(mode === "stations" ? "regular" : "quick");
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
  const [customerRegion, setCustomerRegion] = useState<{ latitude: number; longitude: number } | null>(null);
  const [quickTargets, setQuickTargets] = useState<Array<{ name: string; distance?: number | null }>>([]);
  const [customerBookings, setCustomerBookings] = useState<CustomerBookingStatus[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showCompactMap, setShowCompactMap] = useState(mode === "map");
  const spinAnim = useRef(new Animated.Value(0)).current;

  const rankedStations = useMemo(
    () =>
      [...stations]
        .map((station) => ({ station, distance: distanceKm(customerRegion, station) }))
        .sort((a, b) => (a.distance ?? 99999) - (b.distance ?? 99999)),
    [customerRegion, stations],
  );

  const selectedStation = useMemo(
    () => stations.find((station) => station.id === selectedStationId) || rankedStations[0]?.station || null,
    [rankedStations, selectedStationId, stations],
  );

  const selectedService = useMemo(
    () => selectedStation?.services.find((service) => service.id === selectedServiceId) || selectedStation?.services[0] || null,
    [selectedServiceId, selectedStation],
  );

  const quickTime = selectedSlot || getNextHalfHourTime();
  const discountAmount =
    selectedService && spinResult ? (selectedService.price * spinResult.discountPercent) / 100 : 0;
  const finalPrice = selectedService ? selectedService.price - discountAmount : 0;
  const selectedStationDistance = selectedStation ? distanceKm(customerRegion, selectedStation) : null;

  useEffect(() => {
    if (stations.length === 0) {
      setSelectedStationId(null);
      setSelectedServiceId(null);
      return;
    }
    if (!selectedStationId || !stations.some((station) => station.id === selectedStationId)) {
      setSelectedStationId(rankedStations[0]?.station.id || stations[0].id);
    }
  }, [rankedStations, selectedStationId, stations]);

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

  useEffect(() => {
    if (!customerPhone.trim()) {
      setCustomerBookings([]);
      return;
    }

    let mounted = true;
    const loadStatuses = async (silent = false) => {
      if (!silent) setStatusLoading(true);
      try {
        const rows = await fetchCustomerBookings(customerPhone);
        if (!mounted) return;
        setCustomerBookings(rows);
      } catch {
        if (!mounted) return;
      } finally {
        if (mounted && !silent) setStatusLoading(false);
      }
    };

    loadStatuses();
    const timer = setInterval(() => loadStatuses(true), 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [customerPhone]);

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
      throw new Error("فعل إذن الموقع حتى تظهر المحطات حسب القرب ويعمل الحجز السريع بدقة.");
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const nextRegion = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
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
      const targets =
        result.targets?.map((target) => {
          const station = stations.find((item) => item.id === target.station_id);
          return {
            name: target.station_name || station?.name || "محطة",
            distance: target.distance_km ?? (station ? distanceKm(location, station) : null),
          };
        }) || [];
      setQuickTargets(targets);
      const names = targets.map((target) => `${target.name} (${formatDistance(target.distance)})`).join("، ");
      showNotice(
        names
          ? `تم إرسال الطلب إلى: ${names}. سنبلغك داخل التطبيق عند موافقة أي محطة.`
          : "تم إرسال الحجز السريع إلى أقرب المحطات ضمن نطاقك. سنبلغك عند رد المحطات.",
        "success",
      );
      await reload();
      await fetchCustomerBookings(customerPhone).then(setCustomerBookings).catch(() => undefined);
    } catch (quickError) {
      const rawMessage = quickError instanceof Error ? quickError.message : "";
      const friendlyMessage =
        rawMessage.includes("non-2xx") || rawMessage.includes("duplicate") || rawMessage.includes("pending")
          ? "لديك حجز سريع قيد الانتظار. يمكنك الانتظار لحين الرد، أو إرسال محاولة أخيرة لمحطات أخرى مختلفة إذا كانت متاحة، أو إلغاء الحجوزات من الزر الموجود هنا."
          : rawMessage || "تعذر إرسال الحجز السريع.";
      showNotice(friendlyMessage, "info");
    } finally {
      setQuickLoading(false);
    }
  };

  const handleCancelAllBookings = async () => {
    if (!customerPhone.trim()) {
      showNotice("أدخل رقم الهاتف أولاً حتى نلغي الحجوزات المرتبطة به.", "info");
      return;
    }

    setCancelLoading(true);
    try {
      const result = await cancelAllMapBookings(customerPhone);
      setBookingResult(null);
      setSpinResult(null);
      setNeedsRespin(false);
      setQuickTargets([]);
      const message = result.alreadyEmpty
        ? "لا توجد حجوزات فعالة على هذا الرقم."
        : `تم إلغاء ${result.cancelledCount} حجز وإبلاغ المحطات.`;
      showNotice(message, "success");
      await reload();
      await fetchCustomerBookings(customerPhone).then(setCustomerBookings).catch(() => undefined);
    } catch (cancelError) {
      showNotice(cancelError instanceof Error ? cancelError.message : "تعذر إلغاء الحجوزات.", "error");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleSpin = async () => {
    if (!selectedStation || !selectedService) return;
    if (!canSpin) {
      showNotice("أكمل بيانات الحجز أولاً: الخدمة، الوقت، الاسم، والهاتف.", "info");
      return;
    }

    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

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
      showNotice(`تم إرسال طلب الحجز بنجاح (#${result.bookingNumber}). ستظهر الموافقة داخل التطبيق.`, "success");
      await fetchCustomerBookings(customerPhone).then(setCustomerBookings).catch(() => undefined);
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
      await fetchCustomerBookings(customerPhone).then(setCustomerBookings).catch(() => undefined);
    } catch (cancelError) {
      showNotice(cancelError instanceof Error ? cancelError.message : "تعذر إلغاء الحجز.", "error");
    } finally {
      setCancelLoading(false);
    }
  };

  const openRoute = (booking: CustomerBookingStatus) => {
    if (!booking.stationLatitude || !booking.stationLongitude) {
      Alert.alert("المسار", "لا توجد إحداثيات لهذه المحطة.");
      return;
    }
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${booking.stationLatitude},${booking.stationLongitude}`);
  };

  const rotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", `${1080 + (spinResult?.discountPercent || 15) * 12}deg`],
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={gradients.hero} style={styles.heroCard}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>W</Text>
        </View>
        <Text style={styles.heroBadge}>Washlly Mobile</Text>
        <Text style={styles.heroTitle}>احجز غسيل سيارتك بدون تعقيد</Text>
        <Text style={styles.heroText}>اختر حجز سريع لأقرب المحطات، أو حجز اعتيادي من قائمة مرتبة حسب القرب.</Text>
        <View style={styles.heroActions}>
          <Pressable
            style={[styles.modeButton, bookingMode === "quick" && styles.modeButtonActive]}
            onPress={() => setBookingMode("quick")}
          >
            <Text style={[styles.modeButtonText, bookingMode === "quick" && styles.modeButtonTextActive]}>
              حجز سريع
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, bookingMode === "regular" && styles.modeButtonActive]}
            onPress={() => setBookingMode("regular")}
          >
            <Text style={[styles.modeButtonText, bookingMode === "regular" && styles.modeButtonTextActive]}>
              حجز اعتيادي
            </Text>
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

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>بيانات الزبون والموقع</Text>
        <Field label="اسم الزبون" value={customerName} onChangeText={setCustomerName} placeholder="مصطفى" />
        <Field label="رقم الهاتف" value={customerPhone} onChangeText={setCustomerPhone} placeholder="0773XXXXXXX" />
        <View style={styles.actionsRow}>
          <Pressable style={styles.locateButton} onPress={() => locateCustomer().catch((err) => Alert.alert("الموقع", err.message))}>
            <Text style={styles.locateButtonText}>{customerRegion ? "تم تحديد الموقع" : "تحديد موقعي"}</Text>
          </Pressable>
          <Pressable
            style={[styles.cancelAllButton, cancelLoading && styles.disabledButton]}
            onPress={handleCancelAllBookings}
            disabled={cancelLoading}
          >
            {cancelLoading ? <ActivityIndicator color={palette.deepBlue} /> : <Text style={styles.cancelAllButtonText}>إلغاء كل الحجوزات</Text>}
          </Pressable>
        </View>
      </View>

      {bookingMode === "quick" ? (
        <View style={styles.quickPanel}>
          <View style={styles.quickHeader}>
            <Text style={styles.quickTitle}>الحجز السريع</Text>
            <Text style={styles.quickBadge}>أقرب 3 محطات</Text>
          </View>
          <Text style={styles.quickText}>
            سنرسل طلبك لأقرب محطات ضمن نطاقك، وبعد موافقة أي محطة ستظهر لك داخل التطبيق مع زر المسار.
          </Text>
          <View style={styles.quickPreview}>
            {rankedStations.slice(0, 3).map(({ station, distance }, index) => (
              <View key={station.id} style={styles.quickPreviewRow}>
                <Text style={styles.quickPreviewIndex}>{index + 1}</Text>
                <View style={styles.quickPreviewInfo}>
                  <Text style={styles.quickPreviewName}>{station.name}</Text>
                  <Text style={styles.quickPreviewMeta}>{formatDistance(distance)}</Text>
                </View>
              </View>
            ))}
          </View>
          <Pressable
            style={[styles.quickSubmit, quickLoading && styles.disabledButton]}
            onPress={handleQuickBooking}
            disabled={quickLoading}
          >
            {quickLoading ? <ActivityIndicator color={palette.white} /> : <Text style={styles.quickSubmitText}>إرسال الحجز السريع</Text>}
          </Pressable>
          {quickTargets.length > 0 ? (
            <View style={styles.sentBox}>
              <Text style={styles.sentTitle}>تم الإرسال إلى</Text>
              {quickTargets.map((target) => (
                <Text key={`${target.name}-${target.distance}`} style={styles.sentLine}>
                  {target.name} • {formatDistance(target.distance)}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View>
          <Text style={styles.sectionTitle}>الحجز الاعتيادي</Text>
          <Text style={styles.sectionSub}>اختر محطة حسب القرب، ثم اختر الخدمة والوقت ولف عجلة الخصم.</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {rankedStations.map(({ station, distance }) => {
              const active = station.id === selectedStation?.id;
              return (
                <Pressable
                  key={station.id}
                  onPress={() => setSelectedStationId(station.id)}
                  style={[styles.stationChip, active && styles.stationChipActive]}
                >
                  <Text style={[styles.stationChipName, active && styles.stationChipNameActive]}>{station.name}</Text>
                  <Text style={[styles.stationChipMeta, active && styles.stationChipMetaActive]}>
                    {formatDistance(distance)} • {station.open ? "مفتوح" : "مغلق"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedStation ? (
            <>
              <View style={styles.selectedStationCard}>
                <Text style={styles.selectedStationName}>{selectedStation.name}</Text>
                <Text style={styles.selectedStationMeta}>
                  {selectedStation.area} • {formatDistance(selectedStationDistance)}
                </Text>
              </View>

              <Text style={styles.stepTitle}>الخدمة</Text>
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
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.stepTitle}>اليوم والوقت</Text>
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
                <View style={styles.panel}>
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
                    <Text style={styles.panelText}>لا توجد أوقات متاحة في هذا اليوم.</Text>
                  )}
                </View>
              ) : null}

              <View style={styles.spinCard}>
                <View style={styles.wheelWrap}>
                  <View style={styles.pointer} />
                  <Animated.View style={[styles.wheel, { transform: [{ rotate: rotation }] }]}>
                    {SPIN_SEGMENTS.map((segment, index) => (
                      <View key={segment} style={[styles.wheelSegment, index % 2 === 0 ? styles.wheelSegmentA : styles.wheelSegmentB]}>
                        <Text style={styles.wheelSegmentText}>{segment}%</Text>
                      </View>
                    ))}
                    <View style={styles.wheelCenter}>
                      <Text style={styles.wheelCenterText}>{spinResult ? `${spinResult.discountPercent}%` : "خصم"}</Text>
                    </View>
                  </Animated.View>
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

              <View style={styles.panel}>
                {bookingResult ? (
                  <Text style={styles.bookingInfo}>رقم الحجز الحالي: #{bookingResult.bookingNumber}</Text>
                ) : (
                  <Text style={styles.panelText}>بعد تثبيت الخصم اضغط تأكيد لإرسال الحجز إلى المحطة.</Text>
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
        </View>
      )}

      <View style={styles.statusPanel}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>إشعارات الحجز داخل التطبيق</Text>
          {statusLoading ? <ActivityIndicator color={palette.deepBlue} /> : null}
        </View>
        {customerBookings.length === 0 ? (
          <Text style={styles.panelText}>أدخل رقم الهاتف لتظهر آخر الحجوزات وحالة رد المحطات.</Text>
        ) : (
          customerBookings.map((booking) => (
            <View key={booking.id} style={styles.bookingStatusCard}>
              <Text style={styles.bookingStatusTitle}>#{booking.bookingNumber} • {booking.stationName}</Text>
              <Text style={styles.bookingStatusMeta}>
                {statusLabel(booking.status)} • {booking.bookingDate || "--"} {booking.bookingTime?.slice(0, 5) || ""}
              </Text>
              {booking.status === "confirmed" ? (
                <Pressable style={styles.routeButton} onPress={() => openRoute(booking)}>
                  <Text style={styles.routeButtonText}>فتح المسار إلى المحطة</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </View>

      <View style={styles.mapTail}>
        <Text style={styles.mapTailTitle}>الخريطة</Text>
        <Text style={styles.mapTailText}>الخريطة اختيارية ومصغرة للموقع فقط، بدون أزرار الحجز والتثبيت الموجودة في الويب.</Text>
        <View style={styles.mapActions}>
          <Pressable style={[styles.mapButton, showCompactMap && styles.mapButtonActive]} onPress={() => setShowCompactMap(true)}>
            <Text style={[styles.mapButtonText, showCompactMap && styles.mapButtonTextActive]}>إظهار الخريطة</Text>
          </Pressable>
          <Pressable style={[styles.mapButton, !showCompactMap && styles.mapButtonActive]} onPress={() => setShowCompactMap(false)}>
            <Text style={[styles.mapButtonText, !showCompactMap && styles.mapButtonTextActive]}>إخفاء الخريطة</Text>
          </Pressable>
        </View>
        {showCompactMap ? (
          <View style={styles.webMapWrap}>
            <WebView
              source={{ uri: "https://www.washlly.com/mobile-map" }}
              style={styles.webMap}
              geolocationEnabled
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webMapLoading}>
                  <ActivityIndicator color={palette.deepBlue} />
                  <Text style={styles.webMapLoadingText}>جاري تحميل الخريطة...</Text>
                </View>
              )}
            />
          </View>
        ) : null}
      </View>

      <Pressable style={styles.ownerLink} onPress={onOpenOwner}>
        <Text style={styles.ownerLinkText}>دخول بوابة المحطة</Text>
      </Pressable>
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
  screen: { flex: 1, backgroundColor: "#f4f9fd" },
  content: { padding: 18, paddingBottom: 38 },
  heroCard: { borderRadius: 28, padding: 20, marginBottom: 16, overflow: "hidden" },
  logoCircle: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  logoText: { color: palette.white, fontWeight: "900", fontSize: 28 },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: palette.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "800",
    marginBottom: 8,
  },
  heroTitle: { fontSize: 29, lineHeight: 38, color: palette.white, fontWeight: "900", textAlign: "right" },
  heroText: { color: "rgba(255,255,255,0.82)", textAlign: "right", lineHeight: 22, marginTop: 8 },
  heroActions: { flexDirection: "row-reverse", marginTop: 16, gap: 8 },
  modeButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingVertical: 13,
    alignItems: "center",
  },
  modeButtonActive: { backgroundColor: palette.white, borderColor: palette.white },
  modeButtonText: { color: palette.white, fontWeight: "900" },
  modeButtonTextActive: { color: palette.deepBlue },
  noticeBox: { borderRadius: 18, borderWidth: 1, padding: 13, marginBottom: 14 },
  noticeTitle: { textAlign: "right", fontWeight: "900", marginBottom: 6 },
  noticeText: { textAlign: "right", lineHeight: 20 },
  panel: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#0b1b2b",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  panelTitle: { textAlign: "right", color: palette.text, fontSize: 18, fontWeight: "900", marginBottom: 10 },
  panelText: { textAlign: "right", color: palette.muted, lineHeight: 21 },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { textAlign: "right", color: palette.text, fontWeight: "800", marginBottom: 6 },
  input: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: "#f8fbfe",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: palette.text,
  },
  actionsRow: { flexDirection: "row-reverse", gap: 8, marginTop: 8 },
  locateButton: {
    flex: 1,
    backgroundColor: "#e8f3fb",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderColor: "#cfe4f4",
    borderWidth: 1,
  },
  locateButtonText: { color: palette.deepBlue, fontWeight: "900" },
  cancelAllButton: {
    flex: 1,
    backgroundColor: "#fff6e4",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderColor: "#f2d9a3",
    borderWidth: 1,
  },
  cancelAllButtonText: { color: "#7a4a00", fontWeight: "900" },
  quickPanel: {
    backgroundColor: "#0d335f",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
  },
  quickHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  quickTitle: { color: palette.white, fontWeight: "900", fontSize: 24 },
  quickBadge: {
    color: palette.white,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "800",
  },
  quickText: { textAlign: "right", color: "rgba(255,255,255,0.82)", lineHeight: 22, marginTop: 10 },
  quickPreview: { marginTop: 14, gap: 8 },
  quickPreviewRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 10,
    gap: 10,
  },
  quickPreviewIndex: {
    width: 30,
    height: 30,
    borderRadius: 15,
    textAlign: "center",
    textAlignVertical: "center",
    color: palette.deepBlue,
    backgroundColor: palette.white,
    fontWeight: "900",
  },
  quickPreviewInfo: { flex: 1 },
  quickPreviewName: { color: palette.white, textAlign: "right", fontWeight: "900" },
  quickPreviewMeta: { color: "rgba(255,255,255,0.75)", textAlign: "right", marginTop: 3 },
  quickSubmit: { backgroundColor: "#19a7ce", borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 14 },
  quickSubmitText: { color: palette.white, fontWeight: "900", fontSize: 16 },
  sentBox: { marginTop: 12, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", padding: 12 },
  sentTitle: { color: palette.white, textAlign: "right", fontWeight: "900", marginBottom: 6 },
  sentLine: { color: "rgba(255,255,255,0.82)", textAlign: "right", lineHeight: 22 },
  sectionTitle: { textAlign: "right", color: palette.text, fontWeight: "900", fontSize: 24, marginTop: 4 },
  sectionSub: { textAlign: "right", color: palette.muted, lineHeight: 21, marginTop: 4, marginBottom: 12 },
  horizontalList: { gap: 8, paddingBottom: 10 },
  stationChip: {
    width: 214,
    borderRadius: 18,
    borderColor: palette.line,
    borderWidth: 1,
    backgroundColor: palette.white,
    padding: 13,
  },
  stationChipActive: { borderColor: "#19a7ce", backgroundColor: "#e9f8fc" },
  stationChipName: { textAlign: "right", color: palette.text, fontWeight: "900", marginBottom: 5 },
  stationChipNameActive: { color: palette.deepBlue },
  stationChipMeta: { textAlign: "right", color: palette.muted, fontSize: 12 },
  stationChipMetaActive: { color: palette.deepBlue },
  selectedStationCard: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: "#eaf5ff",
    borderColor: "#cde6fa",
    borderWidth: 1,
    marginBottom: 12,
  },
  selectedStationName: { textAlign: "right", color: palette.deepBlue, fontWeight: "900", fontSize: 20 },
  selectedStationMeta: { textAlign: "right", color: palette.muted, marginTop: 5 },
  stepTitle: { textAlign: "right", color: palette.text, fontWeight: "900", fontSize: 18, marginBottom: 8 },
  cardsColumn: { marginBottom: 14 },
  serviceCard: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    marginBottom: 8,
  },
  serviceCardActive: { borderColor: "#19a7ce", backgroundColor: "#e9f8fc" },
  serviceName: { textAlign: "right", color: palette.text, fontWeight: "900" },
  serviceNameActive: { color: palette.deepBlue },
  serviceMeta: { textAlign: "right", color: palette.muted, marginTop: 4 },
  serviceMetaActive: { color: palette.deepBlue },
  dateChip: {
    borderRadius: 999,
    borderColor: palette.line,
    borderWidth: 1,
    backgroundColor: palette.white,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  dateChipActive: { backgroundColor: palette.deepBlue, borderColor: palette.deepBlue },
  dateChipText: { color: palette.text, fontWeight: "800" },
  dateChipTextActive: { color: palette.white },
  slotWrap: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  slotChip: {
    borderRadius: 999,
    borderColor: palette.line,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f9fbff",
  },
  slotChipActive: { backgroundColor: palette.deepBlue, borderColor: palette.deepBlue },
  slotText: { color: palette.text, fontWeight: "800" },
  slotTextActive: { color: palette.white },
  spinCard: { backgroundColor: "#10233f", borderRadius: 22, padding: 15, marginBottom: 14 },
  wheelWrap: { alignItems: "center", marginBottom: 12 },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderTopWidth: 20,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#f7c948",
    marginBottom: -2,
    zIndex: 2,
  },
  wheel: {
    width: 196,
    height: 196,
    borderRadius: 98,
    borderWidth: 8,
    borderColor: palette.white,
    overflow: "hidden",
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: palette.deepBlue,
  },
  wheelSegment: { width: "50%", height: "50%", alignItems: "center", justifyContent: "center" },
  wheelSegmentA: { backgroundColor: "#19a7ce" },
  wheelSegmentB: { backgroundColor: "#16a085" },
  wheelSegmentText: { color: palette.white, fontWeight: "900", fontSize: 20 },
  wheelCenter: {
    position: "absolute",
    top: 61,
    left: 61,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: palette.white,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelCenterText: { color: palette.deepBlue, fontWeight: "900" },
  spinPriceBox: { borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", padding: 11, marginBottom: 10 },
  spinResultLabel: { textAlign: "right", color: "rgba(255,255,255,0.78)", fontSize: 12 },
  spinResultValue: { textAlign: "right", color: palette.white, fontWeight: "900", fontSize: 22, marginTop: 4 },
  spinSubText: { textAlign: "right", color: "rgba(255,255,255,0.72)", marginTop: 4, fontSize: 12 },
  spinButton: { backgroundColor: "#f7c948", borderRadius: 16, alignItems: "center", justifyContent: "center", paddingVertical: 13 },
  spinButtonText: { color: "#273445", fontWeight: "900" },
  confirmButton: { flex: 1, backgroundColor: palette.deepBlue, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  confirmButtonText: { color: palette.white, fontWeight: "900" },
  cancelButton: {
    flex: 1,
    backgroundColor: "#eef4f8",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderColor: palette.line,
    borderWidth: 1,
  },
  cancelButtonText: { color: palette.deepBlue, fontWeight: "900" },
  bookingInfo: { textAlign: "right", color: palette.deepBlue, fontWeight: "900", marginBottom: 8 },
  statusPanel: {
    backgroundColor: palette.white,
    borderRadius: 22,
    padding: 14,
    borderColor: palette.line,
    borderWidth: 1,
    marginBottom: 14,
  },
  statusHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  statusTitle: { textAlign: "right", color: palette.text, fontWeight: "900", fontSize: 18 },
  bookingStatusCard: {
    borderRadius: 16,
    backgroundColor: "#f7fbff",
    borderColor: palette.line,
    borderWidth: 1,
    padding: 11,
    marginTop: 8,
  },
  bookingStatusTitle: { textAlign: "right", color: palette.text, fontWeight: "900" },
  bookingStatusMeta: { textAlign: "right", color: palette.muted, marginTop: 4 },
  routeButton: { backgroundColor: "#e8f6ee", borderRadius: 12, alignItems: "center", paddingVertical: 10, marginTop: 9 },
  routeButtonText: { color: palette.success, fontWeight: "900" },
  mapTail: {
    backgroundColor: "#edf7fd",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#cfe4f4",
    padding: 14,
    marginBottom: 12,
  },
  mapTailTitle: { textAlign: "right", color: palette.deepBlue, fontWeight: "900", fontSize: 18 },
  mapTailText: { textAlign: "right", color: palette.muted, marginTop: 5, lineHeight: 20 },
  mapActions: { flexDirection: "row-reverse", gap: 8, marginTop: 10 },
  mapButton: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cfe4f4",
  },
  mapButtonActive: { backgroundColor: palette.deepBlue, borderColor: palette.deepBlue },
  mapButtonText: { color: palette.deepBlue, fontWeight: "900" },
  mapButtonTextActive: { color: palette.white },
  webMapWrap: {
    height: 260,
    borderRadius: 18,
    overflow: "hidden",
    borderColor: palette.line,
    borderWidth: 1,
    marginTop: 12,
    backgroundColor: "#eef7ff",
  },
  webMap: { flex: 1, backgroundColor: "#eef7ff" },
  webMapLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef7ff",
  },
  webMapLoadingText: {
    color: palette.deepBlue,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
  },
  ownerLink: { alignItems: "center", paddingVertical: 8 },
  ownerLinkText: { color: palette.deepBlue, fontWeight: "900" },
  disabledButton: { opacity: 0.45 },
});
