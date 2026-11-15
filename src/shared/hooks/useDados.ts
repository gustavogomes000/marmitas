import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/data";
import { calcularTotais } from "@/domain/totais";
import type { Categoria, Conta, DiaVenda, Entregador, Movimentacao, ResumoDia, Usuario, Venda } from "@/domain/types";

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
    onMutate: async (novoDia) => {
      await qc.cancelQueries({ queryKey: chaves.dia(data) });
      const anterior = qc.getQueryData<ResumoDia>(chaves.dia(data));
      if (anterior) {
        qc.setQueryData<ResumoDia>(chaves.dia(data), {
          ...anterior,
          dia: novoDia,
          totais: calcularTotais(anterior.vendas, novoDia.precoMarmita),
        });
      }
      return { anterior };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.anterior) qc.setQueryData(chaves.dia(data), ctx.anterior);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: chaves.dia(data) });
      void qc.invalidateQueries({ queryKey: ["dias"] });
      void qc.invalidateQueries({ queryKey: ["vendas-em-aberto"] });
    },
  });
}

export function useSalvarVendas(data: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (novas: Venda[]) => {
      const atual = qc.getQueryData<ResumoDia>(chaves.dia(data));
      if (atual) {
        const mapaAtual = new Map(atual.vendas.map((v) => [v.id, v]));
        const comOrdem = novas.map((v) => mapaAtual.get(v.id) ?? v);
        await repo.salvarVendas(comOrdem);
        return;
      }
      await repo.salvarVendas(novas);
    },
    onMutate: async (novas) => {
      await qc.cancelQueries({ queryKey: chaves.dia(data) });
      const anterior = qc.getQueryData<ResumoDia>(chaves.dia(data));
      if (anterior) {
        // Garante que todos os pedidos existentes tenham uma ordem sequencial única (1, 2, 3...)
        const baseNormalizada = anterior.vendas.map((v, idx) => ({
          ...v,
          ordem: v.ordem > 0 ? v.ordem : idx + 1,
        }));
        // Se havia ordens repetidas (ex.: todos 0), renumera na sequência atual da tela
        const ordensVistas = new Set<number>();
        let temDuplicada = false;
        for (const v of baseNormalizada) {
          if (ordensVistas.has(v.ordem)) {
            temDuplicada = true;
            break;
          }
          ordensVistas.add(v.ordem);
        }
        const base = temDuplicada
          ? anterior.vendas.map((v, idx) => ({ ...v, ordem: idx + 1 }))
          : baseNormalizada;

        const mapa = new Map(base.map((v) => [v.id, v]));
        let maxOrdem = Math.max(0, ...base.map((v) => v.ordem));
        for (const v of novas) {
          const existente = mapa.get(v.id);
          mapa.set(v.id, existente ? { ...v, ordem: existente.ordem } : { ...v, ordem: v.ordem > 0 ? v.ordem : ++maxOrdem });
        }
        const lista = [...mapa.values()].sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
        qc.setQueryData<ResumoDia>(chaves.dia(data), {
          ...anterior,
          vendas: lista,
          totais: calcularTotais(lista, anterior.dia.precoMarmita),
        });
        // Se normalizou ordens antigas que estavam zeradas, persiste todas no banco para travar a posição
        if (temDuplicada && lista.length > novas.length) {
          void repo.salvarVendas(lista);
        }
      }
      return { anterior };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.anterior) qc.setQueryData(chaves.dia(data), ctx.anterior);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: chaves.dia(data) });
      void qc.invalidateQueries({ queryKey: ["dias"] });
      void qc.invalidateQueries({ queryKey: ["vendas-em-aberto"] });
    },
  });
}

export function useRemoverVenda(data: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.removerVenda(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: chaves.dia(data) });
      const anterior = qc.getQueryData<ResumoDia>(chaves.dia(data));
      if (anterior) {
        const lista = anterior.vendas.filter((v) => v.id !== id);
        qc.setQueryData<ResumoDia>(chaves.dia(data), {
          ...anterior,
          vendas: lista,
          totais: calcularTotais(lista, anterior.dia.precoMarmita),
        });
      }
      return { anterior };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.anterior) qc.setQueryData(chaves.dia(data), ctx.anterior);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: chaves.dia(data) });
      void qc.invalidateQueries({ queryKey: ["vendas-em-aberto"] });
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
    onMutate: async (novo) => {
      await qc.cancelQueries({ queryKey: chaves.entregadores });
      const anterior = qc.getQueryData<Entregador[]>(chaves.entregadores);
      const listaAtual = anterior ?? [];
      const existe = listaAtual.some((item) => item.id === novo.id);
      const proxima = existe
        ? listaAtual.map((item) => (item.id === novo.id ? novo : item))
        : [...listaAtual, novo];
      qc.setQueryData<Entregador[]>(chaves.entregadores, proxima);
      return { anterior };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.anterior) qc.setQueryData(chaves.entregadores, ctx.anterior);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: chaves.entregadores });
    },
  });
}

export function useRemoverEntregador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.removerEntregador(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: chaves.entregadores });
      const anterior = qc.getQueryData<Entregador[]>(chaves.entregadores);
      if (anterior) {
        qc.setQueryData<Entregador[]>(
          chaves.entregadores,
          anterior.filter((item) => item.id !== id),
        );
      }
      return { anterior };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.anterior) qc.setQueryData(chaves.entregadores, ctx.anterior);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: chaves.entregadores });
      void qc.invalidateQueries({ queryKey: ["dia"] });
    },
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
