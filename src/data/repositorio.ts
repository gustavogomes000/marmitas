import type {
  Categoria,
  Conta,
  DiaVenda,
  Entregador,
  Movimentacao,
  ResumoDia,
  Usuario,
  Venda,
  VendaEmAberto,
} from "@/domain/types";

export interface Repositorio {
  usuarios(): Promise<Usuario[]>;
  salvarUsuario(usuario: Usuario): Promise<void>;
  removerUsuario(id: string): Promise<void>;

  categorias(): Promise<Categoria[]>;
  salvarCategoria(categoria: Categoria): Promise<void>;
  removerCategoria(id: string): Promise<void>;

  movimentacoes(de: string, ate: string): Promise<Movimentacao[]>;
  salvarMovimentacao(movimentacao: Movimentacao): Promise<void>;
  removerMovimentacao(id: string): Promise<void>;

  dias(de: string, ate: string): Promise<DiaVenda[]>;
  diaPorData(data: string): Promise<DiaVenda | null>;
  salvarDia(dia: DiaVenda): Promise<void>;

  /** Garante que o dia existe e devolve o resumo com as vendas. */
  abrirDia(data: string): Promise<ResumoDia>;
  vendasDoDia(data: string): Promise<ResumoDia>;
  salvarVendas(vendas: Venda[]): Promise<void>;
  removerVenda(id: string): Promise<void>;

  /** Todos os dias do período já com vendas e totais — alimenta o painel. */
  resumosPeriodo(de: string, ate: string): Promise<ResumoDia[]>;
  /** Marmitas prometidas (PG) que ainda não viraram dinheiro, da mais antiga para a mais nova. */
  vendasEmAberto(hoje: string): Promise<VendaEmAberto[]>;

  entregadores(): Promise<Entregador[]>;
  salvarEntregador(entregador: Entregador): Promise<void>;
  removerEntregador(id: string): Promise<void>;

  /** Contas a pagar e parcelas, do vencimento mais antigo para o mais novo. */
  contas(): Promise<Conta[]>;
  salvarContas(contas: Conta[]): Promise<void>;
  removerConta(id: string): Promise<void>;
}
