import { supabase } from "./supabase";
import type {
  BookingCancelResult,
  BookingCreatePayload,
  BookingCreateResult,
  MobileStation,
  QuickBookingResult,
  SpinResult,
} from "../types";

type SpinResponse = {
  success?: boolean;
  error?: string;
  segmentKey?: string;
  discountPercent?: number;
  label?: string;
  token?: string;
  requiresRespin?: boolean;
};

type ApiErrorResponse = {
  error?: string;
};

type BookedTimeRow = {
  booking_time: string | null;
};

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

function hhmmToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHHMM(value: number) {
  const safe = ((value % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const m = (safe % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function getCurrentLocalMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function getLocalTodayISODate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getNextDays(count: number) {
  const list: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const dt = new Date(now);
    dt.setDate(now.getDate() + i);
    const year = dt.getFullYear();
    const month = `${dt.getMonth() + 1}`.padStart(2, "0");
    const day = `${dt.getDate()}`.padStart(2, "0");
    list.push(`${year}-${month}-${day}`);
  }
  return list;
}

export async function fetchBookedSlots(stationId: string, bookingDate: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("booking_time")
    .eq("station_id", stationId)
    .eq("booking_date", bookingDate)
    .in("status", ["pending", "confirmed"]);

  if (error) {
    throw new Error(error.message);
  }

  const set = new Set(
    ((data || []) as BookedTimeRow[])
      .map((row) => row.booking_time?.slice(0, 5))
      .filter((value): value is string => !!value),
  );

  return set;
}

export function generateSlots(
  station: MobileStation,
  bookingDate: string,
  blockedTimes: Set<string>,
) {
  if (station.schedulingType !== "slots") return [] as string[];

  const [startRaw, endRaw] = station.workingHours.split("-").map((part) => part.trim());
  const start = /^\d{2}:\d{2}/.test(startRaw) ? startRaw.slice(0, 5) : "08:00";
  const end = /^\d{2}:\d{2}/.test(endRaw) ? endRaw.slice(0, 5) : "22:00";
  const slotDuration = Math.max(10, station.slotDurationMinutes || 30);

  const startMinutes = hhmmToMinutes(start);
  const endMinutes = hhmmToMinutes(end);
  const today = getLocalTodayISODate();
  const nowMinutes = getCurrentLocalMinutes();

  const slots: string[] = [];
  if (endMinutes >= startMinutes) {
    for (let current = startMinutes; current <= endMinutes; current += slotDuration) {
      const hhmm = minutesToHHMM(current);
      if (bookingDate === today && current <= nowMinutes) continue;
      if (!blockedTimes.has(hhmm)) slots.push(hhmm);
    }
    return slots;
  }

  for (let current = startMinutes; current < 24 * 60; current += slotDuration) {
    const hhmm = minutesToHHMM(current);
    if (bookingDate === today && current <= nowMinutes) continue;
    if (!blockedTimes.has(hhmm)) slots.push(hhmm);
  }

  for (let current = 0; current <= endMinutes; current += slotDuration) {
    const hhmm = minutesToHHMM(current);
    if (bookingDate === today && current <= nowMinutes) continue;
    if (!blockedTimes.has(hhmm)) slots.push(hhmm);
  }

  return slots;
}

export async function spinBookingDiscount(input: {
  stationId: string;
  serviceId: string;
  bookingDate: string;
  bookingTime: string | null;
  customerPhone: string;
}): Promise<{ result?: SpinResult; requiresRespin?: boolean }> {
  const { data, error } = await supabase.functions.invoke<SpinResponse>("spin-booking-discount", {
    body: {
      station_id: input.stationId,
      service_id: input.serviceId,
      booking_date: input.bookingDate,
      booking_time: input.bookingTime,
      customer_phone: normalizePhone(input.customerPhone),
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.success) {
    throw new Error(data?.error || "تعذر تدوير عجلة الخصم.");
  }

  if (data.requiresRespin) {
    return { requiresRespin: true };
  }

  if (!data.token || typeof data.discountPercent !== "number" || !data.segmentKey || !data.label) {
    throw new Error("استجابة عجلة الخصم غير مكتملة.");
  }

  return {
    result: {
      token: data.token,
      discountPercent: data.discountPercent,
      segmentKey: data.segmentKey,
      label: data.label,
    },
  };
}

export async function createMapBooking(payload: BookingCreatePayload): Promise<BookingCreateResult> {
  const { data, error } = await supabase.functions.invoke<BookingCreateResult & ApiErrorResponse>("create-map-booking", {
    body: {
      station_id: payload.stationId,
      service_id: payload.serviceId,
      customer_name: payload.customerName.trim(),
      customer_phone: normalizePhone(payload.customerPhone),
      booking_date: payload.bookingDate,
      booking_time: payload.bookingTime,
      spin_discount_percent: payload.spinDiscountPercent,
      spin_token: payload.spinToken,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data || (data as ApiErrorResponse).error || !data.success) {
    throw new Error((data as ApiErrorResponse)?.error || "تعذر إنشاء الحجز.");
  }

  return data;
}

export async function createQuickBooking(payload: {
  customerName: string;
  customerPhone: string;
  bookingDate: string;
  bookingTime: string;
  customerLatitude: number;
  customerLongitude: number;
}): Promise<QuickBookingResult> {
  const { data, error } = await supabase.functions.invoke<QuickBookingResult & ApiErrorResponse>("create-quick-booking", {
    body: {
      customer_name: payload.customerName.trim(),
      customer_phone: normalizePhone(payload.customerPhone),
      booking_date: payload.bookingDate,
      booking_time: payload.bookingTime,
      service_kind: "quick",
      language: "ar",
      customer_lat: payload.customerLatitude,
      customer_lng: payload.customerLongitude,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data || (data as ApiErrorResponse).error || !data.success) {
    throw new Error((data as ApiErrorResponse)?.error || "تعذر إرسال الحجز السريع.");
  }

  return data;
}

export async function cancelMapBooking(bookingId: string, customerPhone: string): Promise<BookingCancelResult> {
  const { data, error } = await supabase.functions.invoke<BookingCancelResult & ApiErrorResponse>("cancel-map-booking", {
    body: {
      booking_id: bookingId,
      customer_phone: normalizePhone(customerPhone),
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data || (data as ApiErrorResponse).error || !data.success) {
    throw new Error((data as ApiErrorResponse)?.error || "تعذر إلغاء الحجز.");
  }

  return data;
}
