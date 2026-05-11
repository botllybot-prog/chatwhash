import { SUPABASE_ANON_PUBLIC_KEY, SUPABASE_FUNCTIONS_BASE, supabase } from './supabase';
import type { OwnerLoginResult, OwnerSignupPayload } from '../types';

async function postFunction<T>(name: string, body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_PUBLIC_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_PUBLIC_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'حدث خطأ غير متوقع');
  }
  return payload as T;
}

export async function signInOwner(identifier: string, password: string): Promise<OwnerLoginResult> {
  const trimmedIdentifier = identifier.trim();
  if (!trimmedIdentifier || !password) {
    return { success: false, error: 'أدخل بيانات تسجيل الدخول كاملة.' };
  }

  try {
    let email = trimmedIdentifier;
    if (!trimmedIdentifier.includes('@')) {
      const lookup = await postFunction<{ success: boolean; email: string }>('owner-login-lookup', { identifier: trimmedIdentifier });
      email = lookup.email;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return { success: false, error: error?.message || 'فشل تسجيل الدخول.' };
    }

    return {
      success: true,
      email,
      sessionToken: data.session.access_token,
      userId: data.user?.id,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'تعذر إكمال تسجيل الدخول.' };
  }
}

export async function signUpOwner(payload: OwnerSignupPayload): Promise<OwnerLoginResult> {
  try {
    const body = {
      owner_name: payload.ownerName,
      owner_phone: payload.ownerPhone,
      email: payload.email || null,
      password: payload.password,
      station: {
        name: payload.stationName,
        category: payload.stationCategory || 'car_wash',
        address: payload.shortAddress,
        detailed_address: payload.detailedAddress,
        working_hours_start: payload.openTime || '08:00',
        working_hours_end: payload.closeTime || '22:00',
        scheduling_type: 'slots',
        slot_duration_minutes: 30,
        latitude: null,
        longitude: null,
      },
      services: [
        {
          name: payload.firstServiceName,
          price: Number(payload.firstServicePrice || 0),
          duration_minutes: Number(payload.firstServiceDuration || 30),
          customer_discount: null,
          sort_order: 0,
        },
      ],
    };

    const result = await postFunction<{ success: boolean; email: string }>('owner-self-register', body);
    return await signInOwner(result.email, payload.password);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'تعذر إنشاء الحساب.' };
  }
}
