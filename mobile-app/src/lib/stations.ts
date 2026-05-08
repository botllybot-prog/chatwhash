import { mockStations } from '../data/mockStations';
import { supabase } from './supabase';
import type { MobileService, MobileStation } from '../types';

function formatHours(start?: string | null, end?: string | null) {
  if (!start || !end) return 'غير محدد';
  return `${start} - ${end}`;
}

function isOpenNow(start?: string | null, end?: string | null) {
  if (!start || !end) return true;
  const now = new Date();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  const current = now.getHours() * 60 + now.getMinutes();
  if (endMinutes >= startMinutes) return current >= startMinutes && current <= endMinutes;
  return current >= startMinutes || current <= endMinutes;
}

function mapEta(index: number) {
  const options = ['3 دقائق', '5 دقائق', '8 دقائق', '12 دقيقة'];
  return options[index % options.length];
}

function mapRating(index: number) {
  const values = [4.9, 4.8, 4.7, 4.6, 4.5];
  return values[index % values.length];
}

export async function fetchStationsWithServices(): Promise<{ stations: MobileStation[]; source: 'live' | 'mock'; error?: string }> {
  try {
    const { data: stationsData, error: stationsError } = await supabase
      .from('stations')
      .select('id, name, address, detailed_address, image_url, latitude, longitude, working_hours_start, working_hours_end, scheduling_type, slot_duration_minutes, is_active')
      .eq('is_active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('created_at', { ascending: false });

    if (stationsError) throw stationsError;

    const stationRows = stationsData || [];
    if (stationRows.length === 0) {
      return { stations: mockStations, source: 'mock', error: 'لا توجد محطات منشورة حالياً، تم عرض بيانات تجريبية.' };
    }

    const stationIds = stationRows.map((item: any) => item.id);
    const { data: servicesData, error: servicesError } = await supabase
      .from('services')
      .select('id, station_id, name, price, duration_minutes, customer_discount, is_active, sort_order')
      .in('station_id', stationIds)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (servicesError) throw servicesError;

    const servicesByStation = new Map<string, MobileService[]>();
    for (const row of servicesData || []) {
      const list = servicesByStation.get(row.station_id) || [];
      list.push({
        id: row.id,
        name: row.name,
        price: Number(row.price || 0),
        durationMinutes: Number(row.duration_minutes || 30),
        customerDiscount: row.customer_discount || null,
      });
      servicesByStation.set(row.station_id, list);
    }

    const stations: MobileStation[] = stationRows.map((row: any, index: number) => ({
      id: row.id,
      name: row.name,
      area: row.address || 'بغداد',
      address: row.address || 'بدون عنوان مختصر',
      detailedAddress: row.detailed_address || null,
      imageUrl: row.image_url || null,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      open: isOpenNow(row.working_hours_start, row.working_hours_end),
      workingHours: formatHours(row.working_hours_start, row.working_hours_end),
      rating: mapRating(index),
      eta: mapEta(index),
      schedulingType: row.scheduling_type || 'slots',
      slotDurationMinutes: Number(row.slot_duration_minutes || 30),
      source: 'live',
      services: servicesByStation.get(row.id) || [],
    }));

    return { stations, source: 'live' };
  } catch (error) {
    return {
      stations: mockStations,
      source: 'mock',
      error: error instanceof Error ? error.message : 'تعذر تحميل المحطات الحقيقية، تم الرجوع إلى البيانات التجريبية.'
    };
  }
}
