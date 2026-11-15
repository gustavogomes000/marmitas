import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/data";
import type { Categoria, Conta, DiaVenda, Entregador, Movimentacao, Usuario, Venda } from "@/domain/types";

export const chaves = {
  usuarios: ["usuarios"] as const,
  categorias: ["categorias"] as const,
  movimentacoes: (de: string, ate: string) => ["movimentacoes", de, ate] as const,
  dias: (de: string, ate: string) => ["dias", de, ate] as const,
  dia: (data: string) => ["dia", data] as const,
  entregadores: ["entregadores"] as const,
  contas: ["contas"] as const,
};

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries();
  };
}

/* ------------------------------------------------------------------ dia */

export function useAbrirDia(data: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => repo.abrirDia(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.dia(data) });
      qc.invalidateQueries({ queryKey: ["dias"] });
    },
  });
}

export function useDia(data: string) {
  return useQuery({ queryKey: chaves.dia(data), queryFn: () => repo.vendasDoDia(data) });
}

export function useSalvarDia(data: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dia: DiaVenda) => repo.salvarDia(dia),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.dia(data) });
      qc.invalidateQueries({ queryKey: ["dias"] });
      qc.invalidateQueries({ queryKey: ["vendas-em-aberto"] });
    },
  });
}

export function useSalvarVendas(data: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vendas: Venda[]) => repo.salvarVendas(vendas),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.dia(data) });
      qc.invalidateQueries({ queryKey: ["dias"] });
      qc.invalidateQueries({ queryKey: ["vendas-em-aberto"] });
    },
  });
}

export function useRemoverVenda(data: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.removerVenda(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.dia(data) });
      qc.invalidateQueries({ queryKey: ["vendas-em-aberto"] });
    },
  });
}

/* ---------------------------------------------------------------- caixa */

export function useMovimentacoes(de: string, ate: string) {
  return useQuery({ queryKey: chaves.movimentacoes(de, ate), queryFn: () => repo.movimentacoes(de, ate) });
}

export function useSalvarMovimentacao(de: string, ate: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: Movimentacao) => repo.salvarMovimentacao(m),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.movimentacoes(de, ate) }),
  });
}

export function useRemoverMovimentacao(de: string, ate: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.removerMovimentacao(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.movimentacoes(de, ate) }),
  });
}

export function useCategorias() {
  return useQuery({ queryKey: chaves.categorias, queryFn: () => repo.categorias() });
}

/** Para o "Paga" da lista do dia: vale qualquer período, então derruba todas as listas de caixa. */
export function useMovimentacaoRapida() {
  const qc = useQueryClient();
  const gravar = useMutation({
    mutationFn: (m: Movimentacao) => repo.salvarMovimentacao(m),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movimentacoes"] }),
  });
  const apagar = useMutation({
    mutationFn: (id: string) => repo.removerMovimentacao(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movimentacoes"] }),
  });
  return { gravar, apagar };
}

export function useSalvarCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: Categoria) => repo.salvarCategoria(c),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.categorias }),
  });
}

/* -------------------------------------------------------- entregadores */

export function useEntregadores() {
  return useQuery({ queryKey: chaves.entregadores, queryFn: () => repo.entregadores() });
}

export function useSalvarEntregador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: Entregador) => repo.salvarEntregador(e),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.entregadores }),
  });
}

export function useRemoverEntregador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.removerEntregador(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.entregadores }),
  });
}

/* -------------------------------------------------------------- usuários */

export function useUsuarios() {
  return useQuery({ queryKey: chaves.usuarios, queryFn: () => repo.usuarios() });
}

export function useSalvarUsuario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (u: Usuario) => repo.salvarUsuario(u),
    onSuccess: invalidar,
  });
}

export function useRemoverUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.removerUsuario(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.usuarios }),
  });
}

/* --------------------------------------------------------------- histórico */

export function useDias(de: string, ate: string) {
  return useQuery({ queryKey: chaves.dias(de, ate), queryFn: () => repo.dias(de, ate) });
}

/** Todos os dias do período com vendas e totais — é o que alimenta o painel. */
export function useResumosPeriodo(de: string, ate: string) {
  return useQuery({
    queryKey: [...chaves.dias(de, ate), "resumo"] as const,
    queryFn: () => repo.resumosPeriodo(de, ate),
  });
}

/** PG que ainda não virou dinheiro, da mais antiga para a mais nova. */
export function useVendasEmAberto(hoje: string) {
  return useQuery({ queryKey: ["vendas-em-aberto", hoje] as const, queryFn: () => repo.vendasEmAberto(hoje) });
}

/* ----------------------------------------------------------------- contas */

export function useContas() {
  return useQuery({ queryKey: chaves.contas, queryFn: () => repo.contas() });
}

export function useSalvarContas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contas: Conta[]) => repo.salvarContas(contas),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.contas });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
    },
  });
}

export function useRemoverConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.removerConta(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.contas });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
    },
  });
}
