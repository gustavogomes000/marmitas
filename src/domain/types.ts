export type StatusVenda = "pendente" | "preparada" | "entregue" | "cancelada";
export type Fluxo = "entrada" | "saida";
export type FormaPagamento = "pix" | "dinheiro" | "cartao" | "outro";
export type Papel = "adm" | "cozinha" | "entregador";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  criadoEm: string;
  ultimoAcesso: string | null;
}

export interface Categoria {
  id: string;
  nome: string;
  fluxo: Fluxo;
  emoji: string;
  cor: string;
  ordem: number;
}

export interface Movimentacao {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  fluxo: Fluxo;
  categoriaId: string;
  forma: FormaPagamento;
  obs: string;
  criadoEm: string;
}

export interface DiaVenda {
  id: string;
  data: string;
  precoMarmita: number;
  /** Título livre do dia ("sábado da feira") — aparece no painel e na agenda. */
  obs: string;
  /** O prato servido naquele dia ("frango assado com batata"). Um só por dia. */
  prato?: string;
  criadoEm: string;
  /** Data em que o dia foi fechado. Null = ainda em aberto. */
  fechadoEm?: string | null;
}

/** Uma conta para pagar: compra avulsa ou uma parcela de um parcelamento. */
export interface Conta {
  id: string;
  descricao: string;
  /** Quem recebe ("Atacadão", "Energia", "Marceneiro"). */
  fornecedor: string;
  valor: number;
  /** Dia em que vence (ISO). */
  vencimento: string;
  categoriaId: string;
  forma: FormaPagamento;
  paga: boolean;
  /** Data em que saiu dinheiro do caixa. */
  pagoEm: string | null;
  /** Agrupa as parcelas do mesmo parcelamento; null = conta única. */
  grupo: string | null;
  /** Posição desta parcela, 1..N. */
  parcela: number | null;
  /** Total de parcelas do grupo. */
  parcelas: number | null;
  obs: string;
}

export interface Venda {
  id: string;
  diaId: string;
  cliente: string;
  qtd: number;
  /** Veio do grupo com "PG": promete pagar depois. */
  pg: boolean;
  /** Dinheiro já recebido. Ao marcar, o valor entra no caixa. */
  paga: boolean;
  entreguePor: string | null;
  status: StatusVenda;
  obs: string;
  ordem: number;
  /** Preço desta marmita quando for diferente do preço do dia (grande, extra de carne). */
  valorUnit: number | null;
  /** Dinheiro a mais na linha: frete, embalagem, adicional. */
  acrescimo: number;
  /** Quanto entrou de verdade ao marcar Paga — permite pagamento parcial. */
  valorPago: number | null;
}

export interface Entregador {
  id: string;
  nome: string;
  telefone: string;
  ativo: boolean;
}

export interface TotaisDia {
  marmitas: number;
  entregues: number;
  preparadas: number;
  pendentes: number;
  canceladas: number;
  receitaBruta: number;
  /** Valor de quem marcou PAGA — já está no caixa. */
  recebido: number;
  /** PG que ainda não virou paga: é o fiado do dia. */
  aReceber: number;
  pgQtd: number;
  pagaQtd: number;
}

export interface ResumoDia {
  dia: DiaVenda;
  vendas: Venda[];
  totais: TotaisDia;
}

/** Uma marmita prometida (PG) que ainda não virou dinheiro no caixa. */
export interface VendaEmAberto {
  venda: Venda;
  dia: DiaVenda;
  valor: number;
  diasSemPagar: number;
}
