export type CustomerSession = {
  customerName: string;
  customerPhone: string;
  sessionToken: string;
  expiresAt: string;
};

const KEY = "washlly_customer_session_v1";

function readSession(storage: Storage | null): CustomerSession | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CustomerSession;
    if (!parsed?.sessionToken || !parsed?.customerPhone || !parsed?.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getCustomerSession(): CustomerSession | null {
  return readSession(localStorage) || readSession(sessionStorage);
}

export function setCustomerSession(session: CustomerSession, options: { persist?: boolean } = {}) {
  const persist = options.persist ?? true;
  const target = persist ? localStorage : sessionStorage;
  const other = persist ? sessionStorage : localStorage;
  other.removeItem(KEY);
  target.setItem(KEY, JSON.stringify(session));
}

export function clearCustomerSession() {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}
