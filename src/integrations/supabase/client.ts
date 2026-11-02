import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  console.error(
    "Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY. Copia .env.example para .env.local e preenche os valores.",
  );
}

export const supabase = createClient<Database>(url ?? "http://localhost", anonKey ?? "missing", {
  auth: { persistSession: true, autoRefreshToken: true, storage: localStorage },
});
