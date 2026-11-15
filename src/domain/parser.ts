import type { Venda } from "./types";
import { normalizar, paraISO, tokens, hojeISO, deISO } from "@/shared/lib/format";

export interface LinhaParseada {
  bruto: string;
  cliente: string;
  qtd: number;
  pg: boolean;
  obs: string;
  /** Linha sem número claro: entra na conferência para você decidir. */
  duvidosa: boolean;
}

export interface ResultadoLeitura {
  data: string | null;
  linhas: LinhaParseada[];
  /** Cabeçalhos e avisos do grupo ("Marmitas Sábado 31/10"). */
  ignoradas: string[];
  /** Linhas com nome mas sem quantidade clara — viram sugestão para revisar. */
  semNumero: string[];
}

const DIAS_SEMANA = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const EMOJI_NO_INICIO = /^[^\p{L}\p{N}]+/u;

/** "Marmitas Sábado 31/10" → 2026-10-31. Sem data clara, devolve null. */
export function extrairData(texto: string): string | null {
  const datas = [...texto.matchAll(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/g)];
  const hoje = hojeISO();
  for (const m of datas) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue;
    const dois = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    const ano = dois ?? deISO(hoje).getFullYear();
    const candidata = paraISO(new Date(ano, mes - 1, dia));
    if (!dois && new Date(candidata).getTime() - new Date(hoje).getTime() > 200 * 86_400_000) {
      return paraISO(new Date(ano - 1, mes - 1, dia));
    }
    return candidata;
  }
  return null;
}

function ehCabecalho(linha: string): boolean {
  const n = normalizar(linha);
  if (!n) return true;
  const temNumero = /\d/.test(linha.replace(/\d{1,2}[\/\-.]\d{1,2}/g, ""));
  const ehData = /\d{1,2}[\/\-.]\d{1,2}/.test(linha);
  const dia = DIAS_SEMANA.some((d) => n.includes(d));
  if (n.startsWith("marmita") || n.startsWith("pedido") || n.startsWith("venda")) return true;
  return ehData && (dia || !temNumero);
}

/** "Gessy 2 + 1" → 3. "Pedro/Ronaldo (sem cheiro verde) 2 PG" → nome + obs + PG. */
export function parsearLinha(bruto: string): LinhaParseada {
  let resto = bruto.trim().replace(EMOJI_NO_INICIO, "").replace(/[*_~`]/g, " ");
  const pg = /(?:^|\s)pg(?:\s|$|[!:.,-])/i.test(resto);
  resto = resto.replace(/(?:^|\s)pg(?:\s|$|[!:.,-])/gi, " ");

  const obsColeta: string[] = [];
  resto = resto.replace(/[([{:](.{1,60}?)[)\]}:]/g, (_t, g: string) => {
    obsColeta.push(g.trim());
    return " ";
  });

  const numeros = [...resto.matchAll(/(?<![\d/])(\d{1,2})(?![\d/])/g)].map((m) => Number(m[1]));
  resto = resto.replace(/(?<![\d/])\d{1,2}(?![\d/])/g, " ");

  const cliente = resto.replace(/\s*[-–—:;,]\s*/g, " ").replace(/\s+/g, " ").trim();
  const soma = numeros.reduce((s, n) => s + n, 0);
  const temSomaExplícita = /\d\s*\+\s*\d/.test(bruto) || numeros.length > 0;

  return {
    bruto: bruto.trim(),
    cliente: cliente || bruto.trim(),
    qtd: temSomaExplícita ? soma : 0,
    pg,
    obs: obsColeta.join(" · "),
    duvidosa: !temSomaExplícita || soma <= 0 || !cliente,
  };
}

export function parsearMensagem(texto: string): ResultadoLeitura {
  const linhasBrutas = texto.split(/\r?\n/);
  const linhas: LinhaParseada[] = [];
  const ignoradas: string[] = [];
  const semNumero: string[] = [];

  for (const bruto of linhasBrutas) {
    if (!bruto.trim()) continue;
    if (ehCabecalho(bruto)) {
      ignoradas.push(bruto.trim());
      continue;
    }
    const lida = parsearLinha(bruto);
    if (lida.duvidosa) semNumero.push(bruto.trim());
    else linhas.push(lida);
  }

  return { data: extrairData(texto), linhas, ignoradas, semNumero };
}

/* ----------------------------------------------------------- conferência */

export type TipoCorrespondencia = "novo" | "igual" | "ajustar" | "extra" | "duvidoso";

export interface PropostaLinha {
  linha: LinhaParseada;
  tipo: TipoCorrespondencia;
  venda?: Venda;
  opcoes?: Venda[];
  qtdAtual?: number;
  qtdNova?: number;
}

function pontuar(linha: string, venda: Venda): number {
  const a = tokens(linha);
  const b = tokens(venda.cliente);
  if (!a.length || !b.length) return 0;
  if (a.join(" ") === b.join(" ")) return 5;
  const compartilhados = a.filter((t) => b.includes(t));
  if (!compartilhados.length) return 0;
  const comecaIgual = a[0] === b[0];
  return compartilhados.length + (comecaIgual ? 2 : 0);
}

/** Compara a mensagem colada com o que já existe no dia, linha a linha. */
export function conferirMensagem(linhas: LinhaParseada[], existentes: Venda[]): PropostaLinha[] {
  return linhas.map((linha) => {
    const candidatas = existentes
      .map((venda) => ({ venda, pontos: pontuar(linha.cliente, venda) }))
      .filter((c) => c.pontos >= 3)
      .sort((x, y) => y.pontos - x.pontos);

    if (!candidatas.length) return { linha, tipo: "novo" as const };

    const melhor = candidatas[0];
    const empate = candidatas.filter((c) => c.pontos === melhor.pontos);
    if (empate.length > 1 && melhor.pontos < 5) {
      return { linha, tipo: "duvidoso" as const, opcoes: empate.map((e) => e.venda) };
    }

    const venda = melhor.venda;
    if (venda.qtd === linha.qtd) return { linha, tipo: "igual" as const, venda };
    if (venda.qtd < linha.qtd && venda.status !== "pendente") {
      return {
        linha,
        tipo: "extra" as const,
        venda,
        qtdAtual: venda.qtd,
        qtdNova: linha.qtd - venda.qtd,
      };
    }
    return {
      linha,
      tipo: "ajustar" as const,
      venda,
      qtdAtual: venda.qtd,
      qtdNova: venda.qtd + linha.qtd,
    };
  });
}

export function nomeParaExibir(cliente: string): string {
  const limpo = cliente.replace(/\s+/g, " ").trim();
  return limpo.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}
