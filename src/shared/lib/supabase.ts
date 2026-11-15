import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseChave, supabaseConfigurado, supabaseUrl } from "./env";

export const db: SupabaseClient | null = supabaseConfigurado
  ? createClient(supabaseUrl, supabaseChave, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
