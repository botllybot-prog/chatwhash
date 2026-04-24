export function normalizeOwnerPhone(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

export function buildOwnerEmail(identifier: string, providedEmail?: string) {
  const normalizedProvidedEmail = providedEmail?.trim().toLowerCase();
  if (normalizedProvidedEmail) return normalizedProvidedEmail;
  const normalizedPhone = normalizeOwnerPhone(identifier);
  return `owner-${normalizedPhone}@washlly.local`;
}
