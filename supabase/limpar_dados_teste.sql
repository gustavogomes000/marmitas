-- =============================================================================
-- D'a Márcia Marmitaria — Limpar todos os dados de teste do sistema
-- =============================================================================
-- Como usar:
-- 1. Abra o painel do Supabase -> SQL Editor -> New Query
-- 2. Cole o comando abaixo e clique em "Run" (ou Ctrl+Enter)
--
-- O que este script faz:
-- • Apaga TODAS as vendas/pedidos de teste (public.vendas)
-- • Apaga TODOS os dias de teste lançados (public.dias_venda)
-- • Apaga TODAS as movimentações de caixa e saldo inicial (public.movimentacoes)
-- • Apaga TODAS as contas a pagar/parcelamentos de teste (public.contas)
-- • Apaga TODOS os entregadores de teste (public.entregadores)
-- • Mantém intactas as categorias padrão do sistema (public.categorias)
-- =============================================================================

begin;

truncate table
  public.vendas,
  public.dias_venda,
  public.movimentacoes,
  public.contas,
  public.entregadores
restart identity cascade;

commit;

-- Atualiza o cache da API do Supabase
notify pgrst, 'reload schema';

