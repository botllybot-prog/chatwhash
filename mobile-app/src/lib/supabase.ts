import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://yhklvtzonvgzkodysawu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inloa2x2dHpvbnZnemtvZHlzYXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTgyMzYsImV4cCI6MjA5MTA3NDIzNn0.K0sxdzG1C1ytFU7Zb-ZCY2tCyEG2ryVUE-7SNdmo7xc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export const SUPABASE_FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
export const SUPABASE_ANON_PUBLIC_KEY = SUPABASE_ANON_KEY;
