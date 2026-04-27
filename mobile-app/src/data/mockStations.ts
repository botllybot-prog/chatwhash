import type { MobileStation } from '../types';

export const mockStations: MobileStation[] = [
  {
    id: 'st-1',
    name: 'Washlly Express',
    area: 'المنصور',
    address: 'المنصور - شارع الأميرات',
    detailedAddress: 'بالقرب من المطاعم وساحة اللقاء',
    latitude: 33.3096,
    longitude: 44.3615,
    open: true,
    workingHours: '08:00 - 22:00',
    rating: 4.9,
    eta: '4 دقائق',
    schedulingType: 'slots',
    slotDurationMinutes: 30,
    source: 'mock',
    services: [
      { id: 'svc-1', name: 'غسيل سريع', price: 10000, durationMinutes: 25, customerDiscount: '5%' },
      { id: 'svc-2', name: 'تنظيف داخلي', price: 15000, durationMinutes: 40, customerDiscount: null },
      { id: 'svc-3', name: 'تلميع', price: 22000, durationMinutes: 55, customerDiscount: '10%' }
    ]
  },
  {
    id: 'st-2',
    name: 'Blue Foam Station',
    area: 'اليرموك',
    address: 'اليرموك - قرب شارع 14 رمضان',
    detailedAddress: 'مقابل الصيدلية المركزية',
    latitude: 33.2974,
    longitude: 44.3293,
    open: true,
    workingHours: '09:00 - 23:00',
    rating: 4.7,
    eta: '7 دقائق',
    schedulingType: 'slots',
    slotDurationMinutes: 30,
    source: 'mock',
    services: [
      { id: 'svc-4', name: 'غسيل خارجي', price: 9000, durationMinutes: 20, customerDiscount: null },
      { id: 'svc-5', name: 'شمع حماية', price: 18000, durationMinutes: 45, customerDiscount: '7%' }
    ]
  },
  {
    id: 'st-3',
    name: 'Royal Wash Hub',
    area: 'الجادرية',
    address: 'الجادرية - شارع الجامعة',
    detailedAddress: 'بجوار الجسر الصغير',
    latitude: 33.2797,
    longitude: 44.4134,
    open: false,
    workingHours: '10:00 - 21:00',
    rating: 4.8,
    eta: '11 دقيقة',
    schedulingType: 'slots',
    slotDurationMinutes: 30,
    source: 'mock',
    services: [
      { id: 'svc-6', name: 'غسيل VIP', price: 30000, durationMinutes: 60, customerDiscount: '15%' },
      { id: 'svc-7', name: 'تعقيم', price: 12000, durationMinutes: 20, customerDiscount: null },
      { id: 'svc-8', name: 'استلام وتسليم', price: 25000, durationMinutes: 50, customerDiscount: null }
    ]
  }
];
