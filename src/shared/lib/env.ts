const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  "https://ysybvdejltyjcxcihicu.supabase.co";
const chave =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  "sb_publishable_xptflzXPg98udZgl1LEVJw_VbNSTCUZ";

/** Sem as duas chaves, o app roda no modo demonstração (dados locais). */
export const supabaseConfigurado = Boolean(url && chave);
export const supabaseUrl = url ?? "";
export const supabaseChave = chave ?? "";
