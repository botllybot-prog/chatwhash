export type CustomerSession = {
  customerName: string;
  customerPhone: string;
  sessionToken: string;
  expiresAt: string;
};

const KEY = "washlly_customer_session_v1";

export function getCustomerSession(): CustomerSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CustomerSession;
    if (!parsed?.sessionToken || !parsed?.customerPhone || !parsed?.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCustomerSession(session: CustomerSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearCustomerSession() {
  localStorage.removeItem(KEY);
}
