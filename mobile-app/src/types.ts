export type MobileService = {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  customerDiscount?: string | null;
};

export type MobileStation = {
  id: string;
  name: string;
  area: string;
  address: string;
  detailedAddress?: string | null;
  latitude: number;
  longitude: number;
  open: boolean;
  workingHours: string;
  rating: number;
  eta: string;
  schedulingType: "slots" | "instant" | "daily";
  slotDurationMinutes: number;
  services: MobileService[];
  source: "live" | "mock";
};

export type OwnerLoginResult = {
  success: boolean;
  email?: string;
  sessionToken?: string;
  userId?: string;
  error?: string;
};

export type OwnerSignupPayload = {
  ownerName: string;
  ownerPhone: string;
  email?: string;
  password: string;
  stationName: string;
  shortAddress: string;
  detailedAddress: string;
  openTime: string;
  closeTime: string;
  firstServiceName: string;
  firstServicePrice: string;
  firstServiceDuration: string;
  firstServiceDiscount: string;
};

export type SpinResult = {
  segmentKey: string;
  discountPercent: number;
  label: string;
  token: string;
};

export type BookingCreatePayload = {
  stationId: string;
  serviceId: string;
  customerName: string;
  customerPhone: string;
  bookingDate: string;
  bookingTime: string | null;
  spinDiscountPercent: number;
  spinToken: string;
};

export type BookingCreateResult = {
  success: true;
  bookingId: string;
  bookingNumber: number;
  status: string;
};

export type BookingCancelResult = {
  success: true;
  bookingNumber?: number;
  alreadyCancelled?: boolean;
};

export type OwnerContext = {
  stationOwnerId: string;
  stationId: string;
  ownerName: string;
  ownerPhone: string;
  freeRequestsQuota: number;
  freeRequestsUsed: number;
  stationName: string;
  stationIsActive: boolean;
  suspensionReason: string | null;
};

export type SubscriptionSummary = {
  id: string;
  packageCode: string | null;
  requestLimit: number | null;
  requestsUsed: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  amount: number | null;
};

export type PaymentRow = {
  id: string;
  amount: number;
  method: string | null;
  status: string;
  paymentDate: string | null;
};

export type PackageDefinition = {
  code: "starter_20" | "growth_50" | "scale_110" | "unlimited_30";
  title: string;
  priceUsd: number;
  requestLimit: number | null;
  description: string;
};
