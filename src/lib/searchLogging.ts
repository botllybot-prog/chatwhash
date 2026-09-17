import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCustomerSession } from "@/lib/customerSession";

const MIN_QUERY_LENGTH = 2;

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export function logSearchEvent(params: {
  searchType: "station" | "service";
  query: string;
  stationId?: string;
  serviceId?: string;
}) {
  const query = params.query.trim();
  if (query.length < MIN_QUERY_LENGTH) return;

  const session = typeof window !== "undefined" ? getCustomerSession() : null;

  // Fire-and-forget: search logging must never block or affect the search UI.
  void supabase.functions.invoke("log-search-event", {
    body: {
      search_type: params.searchType,
      query,
      station_id: params.stationId,
      service_id: params.serviceId,
      customer_phone: session?.customerPhone,
    },
  }).catch(() => {});
}
