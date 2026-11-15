import { supabaseConfigurado } from "@/shared/lib/env";
import { repositorioDemo } from "./demo";
import { repositorioSupabase } from "./supabase";
import type { Repositorio } from "./repositorio";

export const repo: Repositorio = supabaseConfigurado ? repositorioSupabase : repositorioDemo;
export const modoDemonstracao = !supabaseConfigurado;
export type { Repositorio };
