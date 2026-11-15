import type { TotaisDia, Venda } from "./types";

function soma(vendas: Venda[]): number {
  return vendas.reduce((total, v) => total + (v.status === "cancelada" ? 0 : v.qtd), 0);
}

/** Preço de uma unidade da linha: o valor próprio dela ou o preço do dia. */
export function precoUnitario(venda: Venda, preco: number): number {
  return venda.valorUnit ?? preco;
}

/** Quanto a linha vale em reais (unidades × preço + acréscimo). Linha cancelada vale zero. */
export function valorLinha(venda: Venda, preco: number): number {
  if (venda.status === "cancelada") return 0;
  return venda.qtd * precoUnitario(venda, preco) + (venda.acrescimo || 0);
}

/** O que já entrou no caixa por esta linha. */
export function valorRecebido(venda: Venda, preco: number): number {
  if (!venda.paga || venda.status === "cancelada") return 0;
  return venda.valorPago ?? valorLinha(venda, preco);
}

/** O que falta receber desta linha (quem ainda não pagou ou pagou parcial). */
export function faltaReceber(venda: Venda, preco: number): number {
  if (venda.status === "cancelada") return 0;
  return Math.max(0, valorLinha(venda, preco) - valorRecebido(venda, preco));
}

export function calcularTotais(vendas: Venda[], preco: number): TotaisDia {
  const ativas = vendas.filter((v) => v.status !== "cancelada");
  const marmitas = soma(ativas);
  const entregues = soma(ativas.filter((v) => v.status === "entregue"));
  const preparadas = soma(ativas.filter((v) => v.status === "preparada"));
  const pendentes = soma(ativas.filter((v) => v.status === "pendente"));
  const pgQtd = soma(ativas.filter((v) => v.pg));
  const pagaQtd = soma(ativas.filter((v) => v.paga));
  const canceladas = vendas.filter((v) => v.status === "cancelada").reduce((t, v) => t + v.qtd, 0);
  const receitaBruta = vendas.reduce((t, v) => t + valorLinha(v, preco), 0);
  const recebido = vendas.reduce((t, v) => t + valorRecebido(v, preco), 0);
  const aReceber = vendas.reduce((t, v) => t + faltaReceber(v, preco), 0);

  return {
    marmitas,
    entregues,
    preparadas,
    pendentes,
    canceladas,
    receitaBruta,
    recebido,
    aReceber,
    pgQtd,
    pagaQtd,
  };
}

/** Falta montar = ainda está pendente. É o número que vai para a produção. */
export function faltandoMontar(vendas: Venda[]): number {
  return vendas.filter((v) => v.status === "pendente").reduce((t, v) => t + v.qtd, 0);
}

/** A entrada de caixa que representa o "Paga" de uma linha. O id é derivado para dar para desfazer. */
export function idMovimentacaoPagamento(vendaId: string): string {
  return `mov_pag_${vendaId}`;
}

/**
 * Dividir uma linha: as unidades de `qtd` saem da linha original com o status
 * escolhido e viram um pedido separado. Usado quando o cliente compõe mais
 * marmitas sem entregar as que já saíram.
 */
export function dividirVenda(venda: Venda, qtd: number, status: Venda["status"], novoId: string): [Venda, Venda] {
  const mantem = { ...venda, qtd: venda.qtd - qtd };
  const parte: Venda = {
    ...venda,
    id: novoId,
    qtd,
    status,
    paga: false,
    valorPago: null,
    entreguePor: status === "entregue" ? venda.entreguePor : null,
    obs: venda.obs,
  };
  return [mantem, parte];
}

/**
 * Unidades a mais para um cliente que já tem a linha adiantada: em vez de
 * mexer no que já foi preparado/entregue, lança-se uma linha nova pendente.
 */
export function linhaExtra(venda: Venda, qtd: number, novoId: string): Venda {
  return {
    ...venda,
    id: novoId,
    qtd,
    status: "pendente",
    paga: false,
    valorPago: null,
    entreguePor: null,
    pg: false,
    obs: "",
  };
}
