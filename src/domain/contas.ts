import type { Conta } from "./types";
import { deISO, diasEntre, hojeISO, paraISO } from "@/shared/lib/format";

export type EstadoConta = "paga" | "vencida" | "hoje" | "proxima" | "futura";

export function idMovimentacaoConta(contaId: string): string {
  return `mov_conta_${contaId}`;
}

export function estadoConta(conta: Conta, hoje = hojeISO()): EstadoConta {
  if (conta.paga) return "paga";
  if (conta.vencimento < hoje) return "vencida";
  if (conta.vencimento === hoje) return "hoje";
  if (diasEntre(hoje, conta.vencimento) <= 7) return "proxima";
  return "futura";
}

export function rotuloEstado(estado: EstadoConta): string {
  if (estado === "paga") return "paga";
  if (estado === "vencida") return "vencida";
  if (estado === "hoje") return "vence hoje";
  if (estado === "proxima") return "a vencer";
  return "lançada";
}

/** Dias até vencer (negativo = já venceu). */
export function diasParaVencer(conta: Conta, hoje = hojeISO()): number {
  const base = conta.paga ? conta.pagoEm ?? conta.vencimento : hoje;
  const dias = diasEntre(base, conta.vencimento);
  return conta.vencimento < base ? -dias : dias;
}

export interface ResumoContas {
  total: number;
  pagas: number;
  abertas: number;
  vencidas: number;
  vencendoSemana: number;
  proximas: number;
  porVencimento: number;
}

export function resumoContas(contas: Conta[], hoje = hojeISO()): ResumoContas {
  const r: ResumoContas = {
    total: 0,
    pagas: 0,
    abertas: 0,
    vencidas: 0,
    vencendoSemana: 0,
    proximas: 0,
    porVencimento: 0,
  };
  for (const c of contas) {
    r.total += c.valor;
    if (c.paga) {
      r.pagas += c.valor;
      continue;
    }
    r.abertas += c.valor;
    const estado = estadoConta(c, hoje);
    if (estado === "vencida") r.vencidas += c.valor;
    else if (estado === "hoje") r.vencendoSemana += c.valor;
    else if (estado === "proxima") r.vencendoSemana += c.valor;
    else r.proximas += c.valor;
    r.porVencimento += c.valor;
  }
  return r;
}

/** Ordena por vencimento; o que já venceu vem primeiro, depois o resto. */
export function ordenarContas(contas: Conta[], hoje = hojeISO()): Conta[] {
  return [...contas].sort((a, b) => {
    if (a.paga !== b.paga) return a.paga ? 1 : -1;
    const ea = estadoConta(a, hoje);
    const eb = estadoConta(b, hoje);
    const peso = (e: EstadoConta) => (e === "vencida" ? 0 : e === "hoje" ? 1 : e === "proxima" ? 2 : 3);
    if (peso(ea) !== peso(eb)) return peso(ea) - peso(eb);
    return a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1 : 0;
  });
}

export type Intervalo = "semana" | "quinzena" | "mes";

export function proximaData(de: string, intervalo: Intervalo, passo: number): string {
  const d = deISO(de);
  if (intervalo === "mes") return paraISO(new Date(d.getFullYear(), d.getMonth() + passo, d.getDate()));
  const dias = intervalo === "quinzena" ? 15 : 7;
  return paraISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias * passo));
}

export interface DadosParcelamento {
  descricao: string;
  fornecedor: string;
  categoriaId: string;
  forma: Conta["forma"];
  primeiraVencimento: string;
  obs?: string;
}

/**
 * Parcela um valor em N contas iguais. O centavo que sobra da divisão vai todo
 * na última parcela — assim a soma bate com o valor combinado.
 */
export function gerarParcelas(
  dados: DadosParcelamento,
  valorTotal: number,
  n: number,
  intervalo: Intervalo,
): Conta[] {
  const totalCentavos = Math.round(valorTotal * 100);
  const base = Math.floor(totalCentavos / n);
  const grupo = `grp_${Math.random().toString(36).slice(2, 10)}`;
  const lista: Conta[] = [];
  for (let i = 0; i < n; i++) {
    const centavos = i === n - 1 ? totalCentavos - base * (n - 1) : base;
    lista.push({
      id: `con_${grupo}_${i + 1}`,
      descricao: dados.descricao,
      fornecedor: dados.fornecedor,
      valor: centavos / 100,
      vencimento: proximaData(dados.primeiraVencimento, intervalo, i),
      categoriaId: dados.categoriaId,
      forma: dados.forma,
      paga: false,
      pagoEm: null,
      grupo,
      parcela: i + 1,
      parcelas: n,
      obs: dados.obs ?? "",
    });
  }
  return lista;
}
