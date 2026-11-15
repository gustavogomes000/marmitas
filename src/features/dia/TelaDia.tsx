import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  Bike, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardPaste,
  Lock, Minus, Plus, Receipt, RotateCcw, Scissors, Sparkles, Trash2, UtensilsCrossed, Undo2, UserPlus, X,
} from "lucide-react";
import type { Categoria, DiaVenda, FormaPagamento, Venda } from "@/domain/types";
import { conferirMensagem, nomeParaExibir, parsearMensagem, type PropostaLinha } from "@/domain/parser";
import {
  calcularTotais, dividirVenda, faltaReceber, idMovimentacaoPagamento, linhaExtra, precoUnitario,
  valorLinha, valorRecebido,
} from "@/domain/totais";
import { APARENCIA, ENTREGUE, PAGA, PREPARADA, estaMontada } from "@/shared/lib/status";
import {
  AreaTexto, Barra, BarraProgresso, Botao, Campo, Cartao, Chip, NumeroAnimado, Sheet, TituloSecao, Vazio,
} from "@/shared/components/ui";
import {
  dataCurta, deISO, diaDaSemana, hojeISO, moeda, normalizar, paraISO, paraNumero, rotuloRelativo,
} from "@/shared/lib/format";
import { MOLINHO, itemLista, listaStagger } from "@/shared/lib/motion";
import { uid } from "@/shared/lib/storage";
import { useReduzirMovimento, vibrar } from "@/shared/hooks/useAnimacao";
import {
  useAbrirDia, useCategorias, useDia, useDias, useEntregadores, useMovimentacaoRapida, useMovimentacoes,
  useRemoverVenda, useSalvarDia, useSalvarVendas,
} from "@/shared/hooks/useDados";
import { cn } from "@/shared/lib/cn";

const FORMAS: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: "pix", rotulo: "Pix" },
  { valor: "dinheiro", rotulo: "Dinheiro" },
  { valor: "cartao", rotulo: "Cartão" },
  { valor: "outro", rotulo: "Outro" },
];

/** Os 7 dias da semana (segunda primeiro) que contém a data escolhida. */
function semanaDe(data: string): string[] {
  const d = deISO(data);
  const recuo = (d.getDay() + 6) % 7;
  const inicio = d.getTime() - recuo * 86_400_000;
  return [0, 1, 2, 3, 4, 5, 6].map((i) => paraISO(new Date(inicio + i * 86_400_000)));
}

function somarDias(data: string, dias: number): string {
  return paraISO(new Date(deISO(data).getTime() + dias * 86_400_000));
}

/** 14 → "14,00": os campos de dinheiro do app usam vírgula. */
function texto(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}

export function TelaDia() {
  const hoje = hojeISO();
  const [params, setParams] = useSearchParams();
  const param = params.get("data");
  const data = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : hoje;
  const mudarData = (nova: string) => {
    const proximos = new URLSearchParams(params);
    if (nova === hoje) proximos.delete("data");
    else proximos.set("data", nova);
    setParams(proximos, { replace: true });
  };

  const dia = useDia(data);
  const diasVizinhos = useDias(somarDias(data, -21), somarDias(data, 7));
  const salvarVendas = useSalvarVendas(data);
  const salvarDia = useSalvarDia(data);
  const abrirDia = useAbrirDia(data);
  const removerVenda = useRemoverVenda(data);
  const caixa = useMovimentacaoRapida();
  const categorias = useCategorias();
  const entregadores = useEntregadores();

  const [colagemAberta, setColagemAberta] = useState(false);
  const [avulsoAberto, setAvulsoAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "montar" | "entregar" | "receber">("todos");
  const [receberAberto, setReceberAberto] = useState(true);
  const [pagando, setPagando] = useState<Venda | null>(null);
  const [detalhe, setDetalhe] = useState<Venda | null>(null);
  const [dividindo, setDividindo] = useState<Venda | null>(null);
  const [escolhendoEntregador, setEscolhendoEntregador] = useState<Venda | null>(null);
  const [fechando, setFechando] = useState(false);
  const [gastoAberto, setGastoAberto] = useState(false);

  const resumo = dia.data;
  const cabecalho: DiaVenda = resumo?.dia ?? { id: `dia_${data}`, data, precoMarmita: 0, obs: "", criadoEm: "" };
  const vendas = resumo?.vendas ?? [];
  const preco = cabecalho.precoMarmita;
  const totais = resumo?.totais ?? calcularTotais([], 0);
  const categoriaVenda = (categorias.data ?? []).find((c) => c.fluxo === "entrada");
  const emAberto = useMemo(() => vendas.filter((v) => faltaReceber(v, preco) > 0), [vendas, preco]);

  const movimentosDia = useMovimentacoes(data, data);
  const gastos = useMemo(
    () => (movimentosDia.data ?? []).filter((m) => m.fluxo === "saida"),
    [movimentosDia.data],
  );
  const totalGastos = gastos.reduce((s, m) => s + m.valor, 0);
  const resultadoDia = totais.recebido - totalGastos;
  const categoriasSaida = useMemo(
    () => (categorias.data ?? []).filter((c) => c.fluxo === "saida"),
    [categorias.data],
  );
  const nomeCategoria = (id: string) => (categorias.data ?? []).find((c) => c.id === id)?.nome ?? "sem categoria";
  const criado = (diasVizinhos.data ?? []).some((d) => d.data === data);
  const fechado = Boolean(cabecalho.fechadoEm);

  const nomeDoEntregador = (id: string | null) =>
    id ? (entregadores.data ?? []).find((e) => e.id === id)?.nome ?? "removido" : null;

  const filtradas = useMemo(() => {
    const termo = normalizar(busca);
    let lista = vendas;
    if (termo) lista = lista.filter((v) => normalizar(v.cliente).includes(termo));
    if (filtro === "montar") lista = lista.filter((v) => v.status === "pendente");
    if (filtro === "entregar") lista = lista.filter((v) => estaMontada(v.status) && v.status !== "entregue");
    if (filtro === "receber") lista = lista.filter((v) => faltaReceber(v, preco) > 0);
    return lista;
  }, [vendas, busca, filtro, preco]);

  const aplicar = (lista: Venda[]) => salvarVendas.mutate(lista);

  function definirStatus(venda: Venda, status: Venda["status"]) {
    aplicar([{ ...venda, status }]);
    vibrar(8);
  }

  function alternarPreparada(venda: Venda) {
    definirStatus(venda, venda.status === "preparada" ? "pendente" : "preparada");
  }

  function alternarEntregue(venda: Venda) {
    definirStatus(venda, venda.status === "entregue" ? "preparada" : "entregue");
  }

  function alternarPaga(venda: Venda) {
    if (venda.paga) {
      desfazerPagamento(venda);
      return;
    }
    setPagando(venda);
  }

  /**
   * "+1" numa linha que já saiu da fila não pode desfazer o que a cozinha já
   * fez: a marmita nova entra como pedido separado, ainda pendente.
   */
  function mudarQtd(venda: Venda, delta: number) {
    if (delta > 0 && venda.status !== "pendente") {
      const extra = linhaExtra(venda, 1, uid("ven"));
      aplicar([extra]);
      vibrar(8);
      toast.success(`${nomeParaExibir(venda.cliente)} · +1 em separado`, {
        description: `As ${venda.qtd} que já estão "${venda.status}" não foram mexidas.`,
      });
      return;
    }
    if (delta < 0 && venda.qtd === 1 && venda.status !== "pendente") {
      toast("Tire do status antes de remover a última marmita");
      return;
    }
    const qtd = Math.max(1, venda.qtd + delta);
    if (qtd === venda.qtd) return;
    aplicar([{ ...venda, qtd }]);
  }

  function dividir(venda: Venda, qtd: number, status: Venda["status"]) {
    if (qtd <= 0 || qtd >= venda.qtd) {
      toast("A parte separada precisa ser menor que o pedido");
      return;
    }
    const [mantem, parte] = dividirVenda(venda, qtd, status, uid("ven"));
    aplicar([mantem, parte]);
    setDividindo(null);
    vibrar([8, 20, 8]);
    toast.success(`${nomeParaExibir(venda.cliente)} dividido`, {
      description: `${mantem.qtd} ${venda.status} · ${parte.qtd} ${status}`,
    });
  }

  function registrarPagamento(venda: Venda, valor: number, forma: FormaPagamento, obs: string) {
    aplicar([{ ...venda, paga: true, valorPago: valor }]);
    caixa.gravar.mutate({
      id: idMovimentacaoPagamento(venda.id),
      data,
      descricao: `Marmitas — ${venda.cliente}`,
      valor,
      fluxo: "entrada",
      categoriaId: categoriaVenda?.id ?? "cat_venda",
      forma,
      obs,
      criadoEm: new Date().toISOString(),
    });
    setPagando(null);
    vibrar([8, 20, 8]);
    const falta = Math.max(0, valorLinha(venda, preco) - valor);
    toast.success(`${moeda(valor)} no caixa`, {
      description: falta > 0 ? `${venda.cliente} · ${forma} · faltam ${moeda(falta)}` : `${venda.cliente} · ${forma}`,
    });
  }

  function desfazerPagamento(venda: Venda) {
    aplicar([{ ...venda, paga: false, valorPago: null }]);
    caixa.apagar.mutate(idMovimentacaoPagamento(venda.id));
    toast("Pagamento retirado do caixa");
  }

  function cancelar(venda: Venda, motivo: string) {
    const obs = [venda.obs, motivo ? `cancelada: ${motivo}` : "cancelada"].filter(Boolean).join(" · ");
    aplicar([{ ...venda, status: "cancelada", obs }]);
    if (venda.paga) caixa.apagar.mutate(idMovimentacaoPagamento(venda.id));
    setDetalhe(null);
    vibrar([8, 30, 8]);
    toast(`${nomeParaExibir(venda.cliente)} cancelada${venda.paga ? " e o dinheiro saiu do caixa" : ""}`);
  }

  function refazer(venda: Venda) {
    definirStatus({ ...venda, paga: false, valorPago: null }, "pendente");
    toast("De volta para a fila");
  }

  function escolherEntregador(venda: Venda, entregadorId: string | null) {
    aplicar([{ ...venda, entreguePor: entregadorId }]);
    setEscolhendoEntregador(null);
    setDetalhe((d) => (d?.id === venda.id ? { ...d, entreguePor: entregadorId } : d));
  }

  function fecharDia() {
    salvarDia.mutate({ ...cabecalho, fechadoEm: hoje });
    setFechando(false);
    vibrar([8, 30, 8]);
    toast.success(`Dia ${dataCurta(data)} fechado`, {
      description: emAberto.length
        ? `${emAberto.length} marmita(s) em aberto para cobrar no painel.`
        : "Tudo recebido por aqui.",
    });
  }

  function reabrirDia() {
    salvarDia.mutate({ ...cabecalho, fechadoEm: null });
    toast("Dia aberto de novo");
  }

  const semana = useMemo(() => semanaDe(data), [data]);
  const diasComLancamento = useMemo(() => new Set((diasVizinhos.data ?? []).map((d) => d.data)), [diasVizinhos.data]);
  const [tituloEditando, setTituloEditando] = useState(false);
  const [tituloRascunho, setTituloRascunho] = useState("");
  const [pratoEditando, setPratoEditando] = useState(false);
  const [pratoRascunho, setPratoRascunho] = useState("");

  function salvarTitulo() {
    setTituloEditando(false);
    const limpo = tituloRascunho.trim();
    if (limpo !== cabecalho.obs) {
      salvarDia.mutate({ ...cabecalho, obs: limpo });
      toast.success(limpo ? "Título do dia salvo" : "Título retirado");
    }
  }

  function salvarPrato() {
    setPratoEditando(false);
    const limpo = pratoRascunho.trim();
    if (limpo === (cabecalho.prato ?? "")) return;
    salvarDia.mutate({ ...cabecalho, prato: limpo });
    toast.success(limpo ? `Prato do dia: ${limpo}` : "Prato retirado do dia");
  }

  return (
    <div className="flex flex-col gap-3">
      <BarraProgresso ativo={salvarVendas.isPending || salvarDia.isPending || abrirDia.isPending} />
      <Cartao className="overflow-hidden p-0">
        <div className="flex items-stretch gap-1 border-b border-brand-ink/20 bg-brand px-1.5 py-2 text-crema">
          <button
            onClick={() => mudarData(somarDias(data, -7))}
            aria-label="Semana anterior"
            className="grid size-8 shrink-0 place-items-center rounded-full text-crema/70 transition-colors active:bg-crema/12"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex min-w-0 flex-1 items-stretch justify-between gap-0.5">
            {semana.map((d) => {
              const ativo = d === data;
              return (
                <button
                  key={d}
                  onClick={() => mudarData(d)}
                  aria-current={ativo ? "date" : undefined}
                  className={cn(
                    "relative flex-1 rounded-lg px-0.5 py-1 text-center transition-colors",
                    ativo ? "text-brand-ink" : "text-crema/65",
                  )}
                >
                  {ativo && (
                    <motion.span layoutId="piloto-dia" transition={MOLINHO} className="absolute inset-0 rounded-lg bg-gold" />
                  )}
                  <span className="relative block">
                    <span className="block text-[9px] font-bold uppercase leading-tight tracking-wide opacity-75">
                      {diaDaSemana(d).slice(0, 3)}
                    </span>
                    <span className="num block text-[14px] font-bold leading-tight">{Number(d.slice(8))}</span>
                    <span
                      className={cn(
                        "mx-auto mt-0.5 block size-1 rounded-full",
                        diasComLancamento.has(d) ? (ativo ? "bg-brand-ink/70" : "bg-gold") : "bg-transparent",
                      )}
                    />
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => mudarData(somarDias(data, 7))}
            aria-label="Semana seguinte"
            className="grid size-8 shrink-0 place-items-center rounded-full text-crema/70 transition-colors active:bg-crema/12"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 pb-1 pt-2.5">
          <div className="min-w-0 flex-1">
            {tituloEditando ? (
              <input
                autoFocus
                value={tituloRascunho}
                onChange={(e) => setTituloRascunho(e.target.value)}
                onBlur={salvarTitulo}
                onKeyDown={(e) => e.key === "Enter" && salvarTitulo()}
                placeholder="título do dia"
                className="w-full rounded-lg border border-gold-300 bg-gold-soft/40 px-2 py-1 text-[15px] font-bold text-tinta focus:outline-none"
              />
            ) : (
              <button
                onClick={() => {
                  setTituloRascunho(cabecalho.obs);
                  setTituloEditando(true);
                }}
                className="block max-w-full truncate text-left text-[15px] font-bold text-tinta active:text-brand"
              >
                {cabecalho.obs || `${rotuloRelativo(data)} · ${dataCurta(data)}`}
              </button>
            )}
            <p className="num truncate text-[11px] text-tinta-3">
              {preco > 0 ? `${moeda(preco)} a marmita` : "defina o preço da marmita"}
              {criado ? "" : " · dia ainda não criado"}
            </p>
          </div>
          {data !== hoje && (
            <button
              onClick={() => mudarData(hoje)}
              className="shrink-0 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-brand active:bg-brand/8"
            >
              ir para hoje
            </button>
          )}
          {fechado && (
            <Chip className="shrink-0 border-line bg-neutro/70 text-neutro-ink">
              <Lock size={11} />
              fechado
            </Chip>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 pb-2">
          <UtensilsCrossed size={15} className="shrink-0 text-gold" />
          {pratoEditando ? (
            <input
              autoFocus
              value={pratoRascunho}
              onChange={(e) => setPratoRascunho(e.target.value)}
              onBlur={salvarPrato}
              onKeyDown={(e) => e.key === "Enter" && salvarPrato()}
              placeholder="prato do dia: frango assado com batata"
              className="min-w-0 flex-1 rounded-lg border border-gold-300 bg-gold-soft/40 px-2 py-1 text-[13.5px] font-semibold text-tinta focus:outline-none"
            />
          ) : (
            <button
              onClick={() => {
                setPratoRascunho(cabecalho.prato ?? "");
                setPratoEditando(true);
              }}
              className={cn(
                "min-w-0 flex-1 truncate text-left text-[13px] font-semibold active:text-brand",
                cabecalho.prato ? "text-tinta-2" : "text-tinta-3 italic",
              )}
            >
              {cabecalho.prato || "digitar o prato do dia"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 divide-x divide-line">
          <Metrica rotulo="Marmitas" valor={totais.marmitas} cor="text-brand" />
          <Metrica rotulo="Montadas" valor={totais.preparadas + totais.entregues} cor="text-preparada-ink" />
          <Metrica rotulo="Entregues" valor={totais.entregues} cor="text-entregue" />
          <Metrica rotulo="No caixa" valor={totais.recebido} cor="text-paga-ink" formato={moeda} />
        </div>

        <div className="border-t border-line px-3 py-2.5">
          <Barra
            partes={[
              { valor: totais.entregues, cor: ENTREGUE.barra, chave: "entregue" },
              { valor: totais.preparadas, cor: PREPARADA.barra, chave: "preparada" },
              { valor: totais.pendentes, cor: APARENCIA.pendente.barra, chave: "pendente" },
            ]}
            altura="h-2"
          />
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-tinta-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <Legenda cor={ENTREGUE.ponto} texto={`${totais.entregues} entregues`} />
              <Legenda cor={PREPARADA.ponto} texto={`${totais.preparadas} prontas`} />
              <Legenda cor={PAGA.ponto} texto={`${totais.pagaQtd} pagas`} />
            </span>
            {totais.aReceber > 0 && (
              <span className="num shrink-0 rounded-full bg-paga-soft px-2 py-0.5 text-[10px] font-bold text-paga-ink">
                falta {moeda(totais.aReceber)}
              </span>
            )}
          </div>
        </div>
      </Cartao>

      {!criado && !dia.isPending && (
        <Cartao className="flex flex-col items-start gap-2.5 border-gold-300 bg-gold-soft p-3.5">
          <p className="text-[13px] font-semibold leading-snug text-preparada-ink">
            {rotuloRelativo(data)} ainda não tem dia na agenda. Criar para começar a lançar.
          </p>
          <Botao
            variante="dourado"
            tamanho="sm"
            disabled={abrirDia.isPending}
            onClick={() =>
              abrirDia.mutate(undefined, {
                onSuccess: () => toast.success(`Dia ${dataCurta(data)} criado`),
              })
            }
          >
            <Plus size={16} />
            Criar este dia
          </Botao>
        </Cartao>
      )}

      {emAberto.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={MOLINHO}
          className={cn(
            "card border-paga/40 bg-paga-soft p-0",
            filtro === "receber" && "ring-2 ring-paga/50",
          )}
        >
          <button
            onClick={() => setReceberAberto((o) => !o)}
            aria-expanded={receberAberto}
            className="flex w-full items-center gap-3 p-3 text-left"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paga text-white">
              <CircleDollarSign size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold text-paga-ink">
                {emAberto.length} em aberto · {moeda(totais.aReceber)}
              </span>
              <span className="block truncate text-[11.5px] text-paga-ink/80">
                {receberAberto ? "Dando baixa um por um" : "Toque para ver quem ficou de pagar"}
              </span>
            </span>
            <ChevronDown
              size={16}
              className={cn("shrink-0 text-paga-ink transition-transform", receberAberto && "rotate-180")}
            />
          </button>

          <AnimatePresence initial={false}>
            {receberAberto && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={MOLINHO}
                className="overflow-hidden"
              >
                {emAberto.map((venda) => (
                  <LinhaReceber
                    key={venda.id}
                    venda={venda}
                    falta={faltaReceber(venda, preco)}
                    aoReceber={() => setPagando(venda)}
                  />
                ))}
                <li className="px-3 pb-3 pt-1">
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    className="text-[12px] text-paga-ink"
                    onClick={() => setFiltro(filtro === "receber" ? "todos" : "receber")}
                  >
                    {filtro === "receber" ? "Mostrar todos os pedidos" : "Isolar só esses na lista"}
                  </Botao>
                </li>
              </motion.ul>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      <Cartao className="flex flex-col gap-3 p-3.5">
        <div className="flex flex-col gap-2">
          <Campo
            key={`${data}-${preco}`}
            rotulo={`Preço da marmita · ${rotuloRelativo(data)}`}
            inputMode="decimal"
            prefixo="R$"
            dica="0,00"
            defaultValue={preco ? String(preco).replace(".", ",") : ""}
            onBlur={(e) => {
              const novo = paraNumero(e.currentTarget.value);
              if (novo !== preco) {
                salvarDia.mutate({ ...cabecalho, precoMarmita: novo });
                toast.success(novo ? `Preço do dia: ${moeda(novo)}` : "Preço retirado");
              }
            }}
            className="flex-1"
          />
          {preco === 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-tinta-3">Atalhos:</span>
              {[15, 18, 20, 22, 25].map((sugestao) => (
                <button
                  key={sugestao}
                  type="button"
                  onClick={() => {
                    vibrar(8);
                    salvarDia.mutate({ ...cabecalho, precoMarmita: sugestao });
                    toast.success(`Preço do dia: ${moeda(sugestao)}`);
                  }}
                  className="num rounded-full border border-line bg-crema-2/80 px-2.5 py-1 text-[11.5px] font-bold text-brand transition-transform active:scale-95 active:bg-brand-soft"
                >
                  R$ {sugestao}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Botao variante="primario" tamanho="md" className="h-11" onClick={() => setColagemAberta(true)}>
            <ClipboardPaste size={17} />
            Colar grupo
          </Botao>
          <Botao variante="neutro" tamanho="md" className="h-11" onClick={() => setAvulsoAberto(true)}>
            <UserPlus size={17} />
            Pedido avulso
          </Botao>
        </div>
      </Cartao>

      <Cartao className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 font-display text-[15px] font-semibold text-brand">Gastos do dia</p>
          <Botao variante="neutro" tamanho="sm" className="h-8 shrink-0 gap-1 px-2.5 text-[12px]" onClick={() => setGastoAberto(true)}>
            <Plus size={14} />
            Gasto
          </Botao>
        </div>

        {gastos.length === 0 ? (
          <p className="px-1 text-[12.5px] text-tinta-3">
            Nada lançado como gasto em {dataCurta(data)}. Comprou arroz, gás ou carne para a semana? Lance aqui para
            saber quanto sobrou do dia.
          </p>
        ) : (
          <ul className="flex flex-col">
            {gastos.map((m) => (
              <li key={m.id} className="flex items-center gap-2 border-t border-line py-1.5 first:border-t-0">
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-tinta">
                  {m.descricao || "gasto"}
                  <span className="ml-1.5 text-[10.5px] font-normal text-tinta-3">{nomeCategoria(m.categoriaId)}</span>
                </span>
                <span className="num shrink-0 text-[13px] font-bold text-saida">-{moeda(m.valor)}</span>
                <button
                  onClick={() => caixa.apagar.mutate(m.id)}
                  aria-label={`Remover ${m.descricao || "gasto"}`}
                  className="grid size-7 shrink-0 place-items-center rounded-full text-tinta-3 active:bg-cancelada/10 active:text-cancelada"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-crema-2/60">
          <Metrica rotulo="Recebido" valor={totais.recebido} cor="text-paga-ink" formato={moeda} />
          <Metrica rotulo="Gastos" valor={totalGastos} cor="text-saida" formato={moeda} />
          <Metrica
            rotulo="Sobra do dia"
            valor={resultadoDia}
            cor={resultadoDia >= 0 ? "text-entregue-ink" : "text-cancelada"}
            formato={moeda}
          />
        </div>
      </Cartao>

      {criado && (
        <div className="flex gap-2">
          {fechado ? (
            <Botao variante="neutro" tamanho="sm" className="flex-1" onClick={reabrirDia}>
              <RotateCcw size={16} />
              Reabrir o dia
            </Botao>
          ) : (
            <Botao variante="neutro" tamanho="sm" className="flex-1" onClick={() => setFechando(true)}>
              <Lock size={16} />
              Fechar o dia
            </Botao>
          )}
        </div>
      )}

      {vendas.length > 0 && (
        <div className="flex flex-col gap-2">
          <Campo
            rotulo="Buscar cliente"
            dica="Digite o nome do cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            acaoDireita={
              busca ? (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  aria-label="Limpar busca"
                  className="grid size-7 place-items-center rounded-full bg-crema-2 text-tinta-3 active:scale-95 active:text-tinta"
                >
                  <X size={14} />
                </button>
              ) : undefined
            }
          />
          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(["todos", "montar", "entregar", "receber"] as const).map((f) => {
              const ativo = filtro === f;
              return (
                <motion.button
                  key={f}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  transition={MOLINHO}
                  onClick={() => {
                    vibrar(6);
                    setFiltro(f);
                  }}
                  className={cn(
                    "relative shrink-0 overflow-hidden rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-colors",
                    ativo ? "border-brand text-crema" : "border-line bg-white/85 text-tinta-2",
                  )}
                >
                  {ativo && (
                    <motion.span
                      layoutId="filtro-dia-ativo"
                      transition={MOLINHO}
                      className="absolute inset-0 bg-brand"
                    />
                  )}
                  <span className="relative z-10">
                    {f === "todos" && `Todos (${vendas.length})`}
                    {f === "montar" && `Faltam montar (${totais.pendentes})`}
                    {f === "entregar" && "Prontas p/ entregar"}
                    {f === "receber" && `A receber (${moeda(totais.aReceber)})`}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      <TituloSecao acao={<span className="num text-xs text-tinta-3">{filtradas.length} linhas</span>}>
        Pedidos do dia
      </TituloSecao>

      {dia.isError ? (
        <Cartao className="flex flex-col items-start gap-2.5 border-gold-300 bg-gold-soft p-4">
          <p className="text-[13px] font-semibold leading-snug text-preparada-ink">
            Não consegui abrir os pedidos deste dia. Verifique a internet e tente de novo.
          </p>
          <Botao variante="dourado" tamanho="sm" onClick={() => void dia.refetch()}>
            <RotateCcw size={15} />
            Tentar de novo
          </Botao>
        </Cartao>
      ) : !resumo ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="esqueleto h-24 rounded-[20px]" />
          ))}
        </div>
      ) : vendas.length === 0 ? (
        <Vazio
          icone={<ClipboardPaste size={26} />}
          titulo={`${rotuloRelativo(data)} sem pedidos`}
          descricao="Cole a mensagem do grupo: eu leio nome por nome, somo as quantidades e comparo com o que já existe."
          acao={
            <div className="flex gap-2">
              <Botao variante="dourado" onClick={() => setColagemAberta(true)}>Colar mensagem</Botao>
              {!criado && (
                <Botao variante="neutro" onClick={() => abrirDia.mutate(undefined, { onSuccess: () => toast.success(`Dia ${dataCurta(data)} criado`) })}>
                  <Plus size={16} />
                  Criar dia
                </Botao>
              )}
            </div>
          }
        />
      ) : (
        <motion.ul variants={listaStagger} initial="oculto" animate="visivel" className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {filtradas.map((venda) => (
              <LinhaPedido
                key={venda.id}
                venda={venda}
                preco={preco}
                total={valorLinha(venda, preco)}
                entregador={nomeDoEntregador(venda.entreguePor)}
                aoPreparar={() => alternarPreparada(venda)}
                aoEntregar={() => alternarEntregue(venda)}
                aoPagar={() => alternarPaga(venda)}
                aoAbrirEntregador={() => setEscolhendoEntregador(venda)}
                aoAbrirDetalhe={() => setDetalhe(venda)}
                aoDividir={() => setDividindo(venda)}
                aoMudarQtd={(delta) => mudarQtd(venda, delta)}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <Sheet aberto={Boolean(pagando)} aoFechar={() => setPagando(null)} titulo="Recebimento">
        {pagando && (
          <FormPagamento
            venda={pagando}
            sugestao={valorLinha(pagando, preco)}
            dia={data}
            aoConfirmar={(valor, forma, obs) => registrarPagamento(pagando, valor, forma, obs)}
          />
        )}
      </Sheet>

      <Sheet aberto={gastoAberto} aoFechar={() => setGastoAberto(false)} titulo={`Gasto de ${dataCurta(data)}`}>
        <FormGasto
          categorias={categoriasSaida}
          aoSalvar={(gasto) => {
            caixa.gravar.mutate(
              {
                id: uid("mov"),
                data,
                descricao: gasto.descricao,
                valor: gasto.valor,
                fluxo: "saida",
                categoriaId: gasto.categoriaId,
                forma: gasto.forma,
                obs: gasto.obs,
                criadoEm: new Date().toISOString(),
              },
              {
                onSuccess: () => {
                  setGastoAberto(false);
                  vibrar(8);
                  toast.success(`${moeda(gasto.valor)} gasto em ${dataCurta(data)}`, {
                    description: `${gasto.descricao} · serve para as marmitas da semana`,
                  });
                },
              },
            );
          }}
        />
      </Sheet>

      <Sheet aberto={fechando} aoFechar={() => setFechando(false)} titulo="Fechar o dia">
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-[13px] font-semibold text-tinta">
            {rotuloRelativo(data)}, {dataCurta(data)}
            {cabecalho.obs ? ` · ${cabecalho.obs}` : ""}
          </p>

          <div className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-white">
            <Metrica rotulo="Marmitas" valor={totais.marmitas} cor="text-brand" />
            <Metrica rotulo="No caixa" valor={totais.recebido} cor="text-paga-ink" formato={moeda} />
            <Metrica rotulo="A cobrar" valor={totais.aReceber} cor="text-preparada-ink" formato={moeda} />
          </div>

          {emAberto.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="rounded-xl bg-gold-soft px-3 py-2.5 text-[12.5px] font-semibold leading-snug text-preparada-ink">
                {emAberto.length} marmita(s) ficaram em aberto. Ao fechar o dia elas vão para a lista de
                cobranças do painel, para você marcar o pagamento nos próximos dias.
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {emAberto.slice(0, 10).map((v) => (
                  <li key={v.id} className="num rounded-full border border-gold-300 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-preparada-ink">
                    {nomeParaExibir(v.cliente)} · {v.qtd}
                  </li>
                ))}
                {emAberto.length > 10 && (
                  <li className="num self-center text-[11.5px] text-tinta-3">+{emAberto.length - 10}</li>
                )}
              </ul>
            </div>
          ) : (
            <p className="rounded-xl bg-entregue/12 px-3 py-2.5 text-[12.5px] font-semibold text-entregue-ink">
              Nada em aberto — tudo recebido.
            </p>
          )}

          <Botao variante="primario" tamanho="lg" larguraTotal onClick={fecharDia}>
            <Lock size={17} />
            Fechar {dataCurta(data)}
          </Botao>
        </div>
      </Sheet>

      <Sheet aberto={Boolean(escolhendoEntregador)} aoFechar={() => setEscolhendoEntregador(null)} titulo="Quem entregou?">
        {escolhendoEntregador && (
          <EscolhaEntregador
            atuais={(entregadores.data ?? []).filter((e) => e.ativo)}
            selecionado={escolhendoEntregador.entreguePor}
            aoEscolher={(id) => escolherEntregador(escolhendoEntregador, id)}
          />
        )}
      </Sheet>

      <Sheet aberto={Boolean(dividindo)} aoFechar={() => setDividindo(null)} titulo="Marcar só algumas">
        {dividindo && (
          <PainelDivisao
            venda={dividindo}
            aoConfirmar={(qtd, status) => dividir(dividindo, qtd, status)}
          />
        )}
      </Sheet>

      <Sheet aberto={Boolean(detalhe)} aoFechar={() => setDetalhe(null)} titulo="Detalhe do pedido">
        {detalhe && (
          <DetalhePedido
            key={detalhe.id}
            venda={detalhe}
            preco={preco}
            entregador={nomeDoEntregador(detalhe.entreguePor)}
            aoMudarQtd={(delta) => {
              const vendido = detalhe;
              if (delta > 0 && vendido.status !== "pendente") {
                const extra = linhaExtra(vendido, 1, uid("ven"));
                aplicar([extra]);
                setDetalhe(null);
                toast.success(`${nomeParaExibir(vendido.cliente)} · +1 em separado`, {
                  description: `As ${vendido.qtd} que já estão "${vendido.status}" não foram mexidas.`,
                });
                return;
              }
              const qtd = Math.max(1, vendido.qtd + delta);
              if (qtd === vendido.qtd) return;
              const nova = { ...vendido, qtd };
              aplicar([nova]);
              setDetalhe(nova);
            }}
            aoStatus={(status) => {
              const nova = { ...detalhe, status };
              aplicar([nova]);
              setDetalhe(nova);
            }}
            aoPg={() => {
              const nova = { ...detalhe, pg: !detalhe.pg };
              aplicar([nova]);
              setDetalhe(nova);
            }}
            aoObs={(obs) => {
              const nova = { ...detalhe, obs };
              aplicar([nova]);
              setDetalhe(nova);
            }}
            aoValor={(valorUnit, acrescimo) => {
              const nova = { ...detalhe, valorUnit, acrescimo };
              aplicar([nova]);
              setDetalhe(nova);
              toast.success("Valor atualizado", { description: `${moeda(valorLinha(nova, preco))} na linha` });
            }}
            aoEntregador={() => {
              setDetalhe(null);
              setEscolhendoEntregador(detalhe);
            }}
            aoDividir={() => {
              setDetalhe(null);
              setDividindo(detalhe);
            }}
            aoReceber={() => {
              setDetalhe(null);
              setPagando(detalhe);
            }}
            aoCancelar={(motivo) => cancelar(detalhe, motivo)}
            aoRefazer={() => {
              refazer(detalhe);
              setDetalhe({ ...detalhe, status: "pendente", paga: false, valorPago: null });
            }}
            aoApagar={() => {
              removerVenda.mutate(detalhe.id);
              if (detalhe.paga) caixa.apagar.mutate(idMovimentacaoPagamento(detalhe.id));
              setDetalhe(null);
              toast("Pedido apagado");
            }}
          />
        )}
      </Sheet>

      <Sheet aberto={colagemAberta} aoFechar={() => setColagemAberta(false)} titulo="Colar a mensagem do grupo">
        <PainelColagem
          vendas={vendas}
          diaId={cabecalho.id}
          dataAtual={data}
          aoAplicar={(alteradas, novas) => {
            aplicar([...novas, ...alteradas]);
            setColagemAberta(false);
            toast.success(`${novas.length} novo(s), ${alteradas.length} ajuste(s)`, { description: "Confira a lista do dia." });
          }}
          aoMudarData={mudarData}
        />
      </Sheet>

      <Sheet aberto={avulsoAberto} aoFechar={() => setAvulsoAberto(false)} titulo="Lançar um pedido">
        <FormAvulso
          diaId={cabecalho.id}
          preco={preco}
          aoSalvar={(venda) => {
            aplicar([venda]);
            setAvulsoAberto(false);
            toast.success(`${venda.cliente} · ${venda.qtd} marmita${venda.qtd > 1 ? "s" : ""}`);
          }}
        />
      </Sheet>
    </div>
  );
}

function Metrica({ rotulo, valor, cor, formato }: { rotulo: string; valor: number; cor: string; formato?: (n: number) => string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-1 py-3">
      <NumeroAnimado valor={valor} formatar={formato} className={cn("text-[clamp(14px,4.6vw,19px)] font-bold leading-none", cor)} />
      <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-wide text-tinta-3">{rotulo}</span>
    </div>
  );
}

/** Uma linha da lista "em aberto": quem deve, quanto deve e o botão de dar baixa. */
function LinhaReceber({
  venda,
  falta,
  aoReceber,
}: {
  venda: Venda;
  falta: number;
  aoReceber: () => void;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={MOLINHO}
      className="flex items-center gap-2 border-t border-paga/20 px-3 py-2"
    >
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-paga-ink">
        {nomeParaExibir(venda.cliente)}
        <span className="num ml-1.5 text-[11px] font-bold text-tinta-3">×{venda.qtd}</span>
        {venda.paga && <span className="ml-1.5 text-[10px] font-semibold text-preparada-ink">parcial</span>}
      </span>
      <span className="num shrink-0 text-[12.5px] font-bold text-preparada-ink">{moeda(falta)}</span>
      <Botao
        variante="dourado"
        tamanho="sm"
        className="h-8 shrink-0 gap-1 rounded-full px-3 text-[12px]"
        onClick={aoReceber}
      >
        <Receipt size={13} />
        Receber
      </Botao>
    </motion.li>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <span className={cn("size-2 shrink-0 rounded-full", cor)} />
      {texto}
    </span>
  );
}

function BotaoStatus({
  rotulo,
  ativo,
  cor,
  onClick,
}: {
  rotulo: string;
  ativo: boolean;
  cor: typeof PREPARADA;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      transition={MOLINHO}
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 text-[12.5px] font-bold transition-colors",
        ativo ? cor.solido : cor.inativo,
      )}
    >
      <motion.span
        initial={false}
        animate={{ scale: ativo ? 1 : 0.4, opacity: ativo ? 1 : 0.35 }}
        transition={MOLINHO}
        className="grid size-4 shrink-0 place-items-center rounded-full border-2 border-current"
      >
        {ativo && <Check size={11} strokeWidth={3.5} />}
      </motion.span>
      {rotulo}
    </motion.button>
  );
}

function LinhaPedido({
  venda,
  preco,
  total,
  entregador,
  aoPreparar,
  aoEntregar,
  aoPagar,
  aoAbrirEntregador,
  aoAbrirDetalhe,
  aoDividir,
  aoMudarQtd,
}: {
  venda: Venda;
  preco: number;
  total: number;
  entregador: string | null;
  aoPreparar: () => void;
  aoEntregar: () => void;
  aoPagar: () => void;
  aoAbrirEntregador: () => void;
  aoAbrirDetalhe: () => void;
  aoDividir: () => void;
  aoMudarQtd: (delta: number) => void;
}) {
  const cor = APARENCIA[venda.status];
  const reduzido = useReduzirMovimento();
  const anterior = useRef(venda.status);
  const [pulso, setPulso] = useState(0);
  const falta = faltaReceber(venda, preco);

  useEffect(() => {
    if (venda.status !== anterior.current) {
      anterior.current = venda.status;
      setPulso((p) => p + 1);
    }
  }, [venda.status]);

  return (
    <motion.li
      variants={itemLista}
      exit="saindo"
      layout
      transition={MOLINHO}
      className={cn("card relative overflow-hidden py-2.5 pl-4 pr-2.5 transition-colors duration-300", cor.card)}
    >
      <motion.span
        layout
        transition={MOLINHO}
        className={cn("absolute inset-y-0 left-0 w-1.5", venda.paga && falta <= 0 ? PAGA.barra : cor.barra)}
      />

      {/* flash de confirmação: o card inteiro pisca na cor do status novo */}
      <AnimatePresence>
        {pulso > 0 && !reduzido && (
          <motion.span
            key={pulso}
            initial={{ opacity: 0.55 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className={cn("pointer-events-none absolute inset-0", cor.cheio)}
            aria-hidden
          />
        )}
      </AnimatePresence>

      <div className="relative flex items-center gap-2">
        <button onClick={aoAbrirDetalhe} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-2">
            <span className="truncate text-[17px] font-bold text-tinta">{nomeParaExibir(venda.cliente)}</span>
            {venda.status === "cancelada" && (
              <Chip className="shrink-0 border-cancelada/30 bg-white text-cancelada-ink">cancelada</Chip>
            )}
            {venda.pg && falta > 0 && <Chip className="shrink-0 border-gold-300 bg-white text-preparada-ink">PG</Chip>}
            {venda.paga && <Chip className="shrink-0 border-paga/30 bg-white text-paga-ink">paga</Chip>}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-[11px] text-tinta-3">
            {total > 0 && (
              <span className={cn("num font-semibold", venda.paga && falta <= 0 ? "text-paga-ink" : "text-tinta-2")}>
                {moeda(total)}
              </span>
            )}
            {falta > 0 && <span className="num font-semibold text-cancelada">deve {moeda(falta)}</span>}
            {venda.valorUnit != null && <span className="num text-preparada-ink">preço próprio</span>}
            <span className="truncate">{venda.obs}</span>
          </span>
        </button>

        <span className="flex shrink-0 items-center gap-1 rounded-full bg-white p-1 shadow-suave">
          <button onClick={() => aoMudarQtd(-1)} aria-label={`Diminuir ${venda.cliente}`} className="grid size-8 place-items-center rounded-full bg-crema-2 text-brand active:scale-90">
            <Minus size={14} />
          </button>
          <span className="num w-5 text-center text-[16px] font-bold text-brand">{venda.qtd}</span>
          <button onClick={() => aoMudarQtd(1)} aria-label={`Aumentar ${venda.cliente}`} className="grid size-8 place-items-center rounded-full bg-crema-2 text-brand active:scale-90">
            <Plus size={14} />
          </button>
        </span>

        <button onClick={aoAbrirDetalhe} aria-label={`Detalhes de ${venda.cliente}`} className="grid size-8 shrink-0 place-items-center rounded-full text-tinta-3 active:bg-brand/8">
          <ChevronDown size={16} className="shrink-0" />
        </button>
      </div>

      <div className="relative mt-2 flex items-stretch gap-1.5">
        <BotaoStatus rotulo="Preparada" ativo={venda.status === "preparada"} cor={PREPARADA} onClick={aoPreparar} />
        <BotaoStatus rotulo="Entregue" ativo={venda.status === "entregue"} cor={ENTREGUE} onClick={aoEntregar} />
        <BotaoStatus rotulo="Paga" ativo={venda.paga && falta <= 0} cor={PAGA} onClick={aoPagar} />
      </div>

      <div className="relative mt-1.5 flex min-w-0 items-center gap-3">
        <button
          onClick={aoAbrirEntregador}
          className={cn(
            "flex min-w-0 items-center gap-1 self-start rounded-full px-1.5 py-0.5 text-[11px] transition-colors active:bg-brand/8",
            entregador ? "text-tinta-2" : "text-tinta-3",
          )}
        >
          <Bike size={12} className="shrink-0" />
          <span className="truncate">{entregador ? `${entregador} entregou` : "quem entregou"}</span>
        </button>
        {venda.qtd > 1 && venda.status !== "cancelada" && (
          <button
            onClick={aoDividir}
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-tinta-3 transition-colors active:bg-brand/8"
          >
            <Scissors size={11} className="mr-1 inline" />
            só algumas
          </button>
        )}
      </div>
    </motion.li>
  );
}

/* ------------------------------------------------------------- pagamento */

function FormPagamento({
  venda,
  sugestao,
  dia,
  aoConfirmar,
}: {
  venda: Venda;
  sugestao: number;
  dia: string;
  aoConfirmar: (valor: number, forma: FormaPagamento, obs: string) => void;
}) {
  const [valor, setValor] = useState(sugestao ? sugestao.toFixed(2).replace(".", ",") : "");
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [obs, setObs] = useState("");
  const numerico = paraNumero(valor);

  return (
    <div className="flex flex-col gap-3 pb-2">
      <p className="text-[13px] text-tinta-2">
        <span className="font-bold text-brand">{nomeParaExibir(venda.cliente)}</span> · {venda.qtd} marmita
        {venda.qtd > 1 ? "s" : ""}. O valor entra no caixa de {rotuloRelativo(dia)} —
        ajuste se foi mais caro (frete, extra, desconto).
      </p>

      <div className="card flex items-center justify-between gap-3 p-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-tinta-3">entra no caixa</span>
        <input
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, ""))}
          className="num w-32 bg-transparent text-right text-[26px] font-bold text-paga-ink focus:outline-none"
        />
      </div>

      {sugestao > 0 && (
        <div className="flex gap-2">
          <Botao variante="neutro" tamanho="sm" className="flex-1" onClick={() => setValor(sugestao.toFixed(2).replace(".", ","))}>
            {moeda(sugestao)} exato
          </Botao>
          <Botao variante="neutro" tamanho="sm" className="flex-1" onClick={() => setValor((sugestao + 5).toFixed(2).replace(".", ","))}>
            + frete {moeda(5)}
          </Botao>
          <Botao variante="neutro" tamanho="sm" className="flex-1" onClick={() => setValor((sugestao / 2).toFixed(2).replace(".", ","))}>
            metade
          </Botao>
        </div>
      )}

      {venda.pg && numerico > 0 && numerico < sugestao && (
        <p className="rounded-xl bg-gold-soft px-3 py-2 text-[12.5px] font-semibold text-preparada-ink">
          pagamento parcial: continua PG devendo {moeda(sugestao - numerico)} — aparece em "em aberto" no dia e no painel.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {FORMAS.map((f) => (
          <button
            key={f.valor}
            onClick={() => setForma(f.valor)}
            className={cn(
              "rounded-full border-2 px-3.5 py-1.5 text-[12px] font-semibold transition-colors",
              forma === f.valor ? "border-paga bg-paga-soft text-paga-ink" : "border-line bg-white text-tinta-3",
            )}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      <Campo rotulo="Anotação do recebimento (opcional)" dica="ex.: pagou com nota de R$ 100" value={obs} onChange={(e) => setObs(e.target.value)} />

      <Botao
        variante="primario"
        tamanho="lg"
        larguraTotal
        disabled={numerico <= 0}
        onClick={() => aoConfirmar(numerico, forma, obs.trim())}
      >
        <Receipt size={17} />
        {numerico > 0 ? `Entrar ${moeda(numerico)} no caixa` : "Digite o valor"}
      </Botao>
    </div>
  );
}

/* ---------------------------------------------------------- entregador */

function EscolhaEntregador({
  atuais,
  selecionado,
  aoEscolher,
}: {
  atuais: { id: string; nome: string; telefone: string }[];
  selecionado: string | null;
  aoEscolher: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2 pb-2">
      {atuais.length === 0 && <p className="py-6 text-center text-sm text-tinta-3">Nenhum entregador cadastrado ainda.</p>}
      {atuais.map((e) => (
        <button
          key={e.id}
          onClick={() => aoEscolher(e.id)}
          className={cn(
            "card flex items-center gap-3 p-3 text-left transition-colors",
            selecionado === e.id && "border-entregue bg-entregue/8",
          )}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-[15px] font-bold text-crema">
            {e.nome.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-semibold text-tinta">{e.nome}</span>
            <span className="num block truncate text-[12px] text-tinta-3">{e.telefone || "sem telefone"}</span>
          </span>
          {selecionado === e.id && <Check size={18} className="shrink-0 text-entregue" />}
        </button>
      ))}
      {selecionado && (
        <Botao variante="fantasma" onClick={() => aoEscolher(null)}>
          Tirar entregador
        </Botao>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ dividir linha */

function PainelDivisao({
  venda,
  aoConfirmar,
}: {
  venda: Venda;
  aoConfirmar: (qtd: number, status: Venda["status"]) => void;
}) {
  const [qtd, setQtd] = useState(1);
  const [status, setStatus] = useState<Venda["status"]>("entregue");
  const maximo = venda.qtd - 1;

  return (
    <div className="flex flex-col gap-4 pb-2">
      <p className="text-[13px] leading-relaxed text-tinta-2">
        Separe as marmitas que estão em situações diferentes. As outras{" "}
        <span className="font-bold text-brand">{maximo}</span> continuam{" "}
        <span className="font-semibold">{venda.status}</span>.
      </p>

      <div className="card flex items-center justify-between gap-3 p-3">
        <span className="text-[13px] font-semibold text-tinta-2">quantidade separada</span>
        <span className="flex items-center gap-1 rounded-full bg-crema-2 p-1">
          <button
            onClick={() => setQtd((q) => Math.max(1, q - 1))}
            aria-label="Menos uma"
            className="grid size-9 place-items-center rounded-full bg-white text-brand shadow-suave active:scale-90"
          >
            <Minus size={16} />
          </button>
          <span className="num w-7 text-center text-[18px] font-bold text-brand">{qtd}</span>
          <button
            onClick={() => setQtd((q) => Math.min(maximo, q + 1))}
            aria-label="Mais uma"
            className="grid size-9 place-items-center rounded-full bg-white text-brand shadow-suave active:scale-90"
          >
            <Plus size={16} />
          </button>
        </span>
      </div>

      <div className="flex gap-2">
        {(["pendente", "preparada", "entregue"] as const).map((s) => {
          const cor = s === "pendente" ? APARENCIA.pendente : s === "preparada" ? PREPARADA : ENTREGUE;
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "h-11 flex-1 rounded-xl border-2 text-[12px] font-bold transition-colors",
                status === s ? cor.ativo : cor.inativo,
              )}
            >
              {cor.rotulo}
            </button>
          );
        })}
      </div>

      <Botao variante="dourado" tamanho="lg" larguraTotal onClick={() => aoConfirmar(qtd, status)}>
        <Scissors size={17} />
        Separar {qtd} como {APARENCIA[status].rotulo.toLowerCase()}
      </Botao>
    </div>
  );
}

/* -------------------------------------------------------------- detalhe */

const ANOTACOES_RAPIDAS = [
  "sem cheiro verde",
  "sem cebola",
  "alergia",
  "molho à parte",
  "embalagem extra",
  "esquentar",
  "retirada no balcão",
  "entregar depois",
];

const MOTIVOS_CANCELAMENTO = ["cliente desistiu", "não veio buscar", "marmita estragou", "lançamento duplicado"];

function DetalhePedido({
  venda,
  preco,
  entregador,
  aoMudarQtd,
  aoStatus,
  aoPg,
  aoObs,
  aoValor,
  aoEntregador,
  aoDividir,
  aoReceber,
  aoCancelar,
  aoRefazer,
  aoApagar,
}: {
  venda: Venda;
  preco: number;
  entregador: string | null;
  aoMudarQtd: (delta: number) => void;
  aoStatus: (status: Venda["status"]) => void;
  aoPg: () => void;
  aoObs: (obs: string) => void;
  aoValor: (valorUnit: number | null, acrescimo: number) => void;
  aoEntregador: () => void;
  aoDividir: () => void;
  aoReceber: () => void;
  aoCancelar: (motivo: string) => void;
  aoRefazer: () => void;
  aoApagar: () => void;
}) {
  const [obs, setObs] = useState(venda.obs);
  const [valorUnit, setValorUnit] = useState(venda.valorUnit == null ? "" : texto(venda.valorUnit));
  const [acrescimo, setAcrescimo] = useState(venda.acrescimo <= 0 ? "" : texto(venda.acrescimo));
  const [motivo, setMotivo] = useState("");

  const total = valorLinha(venda, preco);
  const recebido = valorRecebido(venda, preco);
  const falta = faltaReceber(venda, preco);
  const cancelada = venda.status === "cancelada";
  /** Depois de entregue, quantidade e preço viram histórico: só anotação segue livre. */
  const travado = venda.status === "entregue" || cancelada;

  function salvarValores() {
    const unit = valorUnit.trim() ? paraNumero(valorUnit) : null;
    const extra = acrescimo.trim() ? paraNumero(acrescimo) : 0;
    if (unit === venda.valorUnit && extra === (venda.acrescimo || 0)) return;
    aoValor(unit, extra);
  }

  function alternarAnotacao(textoCurto: string) {
    const partes = obs.split(" · ").map((p) => p.trim()).filter(Boolean);
    const proximas = partes.includes(textoCurto)
      ? partes.filter((p) => p !== textoCurto)
      : [...partes, textoCurto];
    const novo = proximas.join(" · ");
    setObs(novo);
    if (novo !== venda.obs) aoObs(novo);
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-[22px] font-semibold text-brand">{nomeParaExibir(venda.cliente)}</p>
          <p className="text-[12px] text-tinta-3">
            {preco > 0 ? `${moeda(precoUnitario(venda, preco))} a marmita` : "sem preço no dia"}
            {venda.valorUnit != null && " · preço próprio"}
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-crema-2 p-1">
          <button
            onClick={() => aoMudarQtd(-1)}
            aria-label="Diminuir"
            disabled={travado}
            className="grid size-9 place-items-center rounded-full bg-white text-brand shadow-suave active:scale-90 disabled:opacity-40"
          >
            <Minus size={16} />
          </button>
          <span className="num w-7 text-center text-[18px] font-bold text-brand">{venda.qtd}</span>
          <button
            onClick={() => aoMudarQtd(1)}
            aria-label="Aumentar"
            disabled={travado}
            className="grid size-9 place-items-center rounded-full bg-white text-brand shadow-suave active:scale-90 disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </span>
      </div>

      <div className="card flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-tinta-3">valor da linha</span>
        <span className="flex items-baseline gap-2">
          <span className="num font-display text-[24px] font-bold text-brand">{moeda(total)}</span>
          {acrescimo.trim() && <span className="num text-[11px] text-tinta-3">com acréscimo</span>}
        </span>
      </div>

      <div className="flex gap-2">
        {(["pendente", "preparada", "entregue"] as const).map((s) => {
          const cor = s === "pendente" ? APARENCIA.pendente : s === "preparada" ? PREPARADA : ENTREGUE;
          return (
            <button
              key={s}
              onClick={() => aoStatus(s)}
              className={cn(
                "h-11 flex-1 rounded-xl border-2 text-[12px] font-bold capitalize transition-colors",
                venda.status === s ? cor.ativo : cor.inativo,
              )}
            >
              {cor.rotulo}
            </button>
          );
        })}
      </div>

      {/* ----------------------------------------------------------- valores */}
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-tinta-3">valor desta marmita</p>
        <div className="flex items-end gap-2">
          <Campo
            rotulo="Por unidade"
            inputMode="decimal"
            prefixo="R$"
            dica={preco > 0 ? texto(preco) : "0,00"}
            value={valorUnit}
            onChange={(e) => setValorUnit(e.target.value.replace(/[^\d,.]/g, ""))}
            onBlur={salvarValores}
            disabled={travado}
            className="flex-1"
            inputClassName="h-11"
          />
          <Campo
            rotulo="Acréscimo"
            inputMode="decimal"
            prefixo="R$"
            dica="0,00"
            value={acrescimo}
            onChange={(e) => setAcrescimo(e.target.value.replace(/[^\d,.]/g, ""))}
            onBlur={salvarValores}
            disabled={travado}
            className="w-28"
            inputClassName="h-11"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao
            variante="neutro"
            tamanho="sm"
            disabled={travado || venda.valorUnit == null}
            onClick={() => {
              setValorUnit("");
              aoValor(null, paraNumero(acrescimo || "0"));
            }}
          >
            <Undo2 size={14} />
            preço do dia
          </Botao>
          {!travado && (
            <Botao
              variante="neutro"
              tamanho="sm"
              onClick={() => {
                setAcrescimo(texto(5));
                aoValor(venda.valorUnit, 5);
              }}
            >
              + frete {moeda(5)}
            </Botao>
          )}
        </div>
        {travado && (
          <p className="text-[11.5px] text-tinta-3">
            {cancelada ? "Pedido cancelado — o valor ficou como ficou." : "Já entregue: para corrigir quantidade ou valor, volte o status antes."}
          </p>
        )}
      </div>

      {/* ------------------------------------------------------- anotaciones */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {ANOTACOES_RAPIDAS.map((a) => {
            const ligado = obs.split(" · ").some((p) => normalizar(p) === normalizar(a));
            return (
              <button
                key={a}
                onClick={() => alternarAnotacao(a)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                  ligado ? "border-brand bg-brand text-crema" : "border-line bg-white text-tinta-2",
                )}
              >
                {a}
              </button>
            );
          })}
        </div>
        <AreaTexto
          rotulo="Observação"
          dica="ex.: entrega na esquina, sem cheiro verde"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          onBlur={() => obs !== venda.obs && aoObs(obs)}
        />
      </div>

      <button onClick={aoEntregador} className="card flex items-center gap-3 p-3 text-left">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-entregue/12 text-entregue">
          <Bike size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-tinta-3">Entregador</span>
          <span className="block truncate text-[16px] font-semibold text-tinta">{entregador ?? "escolher quem entregou"}</span>
        </span>
        <ChevronDown size={16} className="-rotate-90 shrink-0 text-tinta-3" />
      </button>

      <button onClick={aoPg} className={cn("card flex items-center justify-between p-3 text-left", venda.pg && "bg-gold-soft")}>
        <span className="text-[14px] font-semibold text-tinta">PG — veio como paga depois</span>
        <span className={cn("rounded-full border px-3 py-1 text-[12px] font-bold", venda.pg ? "border-preparada text-preparada-ink" : "border-line text-tinta-3")}>
          {venda.pg ? "PG marcado" : "não"}
        </span>
      </button>

      {/* ------------------------------------------------------- recebimento */}
      <button onClick={aoReceber} className="card flex items-center justify-between gap-3 p-3 text-left">
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-tinta-3">recebimento</span>
          <span className="num block truncate text-[15px] font-semibold text-tinta">
            {venda.paga ? `${moeda(recebido)} entrou no caixa` : "nada lançado no caixa"}
          </span>
        </span>
        {falta > 0 ? (
          <span className="num shrink-0 rounded-full bg-cancelada/10 px-3 py-1 text-[12px] font-bold text-cancelada-ink">
            falta {moeda(falta)}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-entregue/12 px-3 py-1 text-[12px] font-bold text-entregue-ink">
            quitada
          </span>
        )}
      </button>

      {venda.qtd > 1 && !cancelada && (
        <Botao variante="neutro" tamanho="md" larguraTotal onClick={aoDividir}>
          <Scissors size={16} />
          Marcar só algumas ({venda.qtd} marmitas nesta linha)
        </Botao>
      )}

      {cancelada ? (
        <Botao variante="sucesso" tamanho="lg" larguraTotal onClick={aoRefazer}>
          <RotateCcw size={17} />
          Refazer o pedido
        </Botao>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl border border-cancelada/25 bg-cancelada/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cancelada-ink">cancelar este pedido</p>
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS_CANCELAMENTO.map((m) => (
              <button
                key={m}
                onClick={() => setMotivo(m)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                  motivo === m ? "border-cancelada bg-cancelada text-white" : "border-line bg-white text-tinta-2",
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <Botao variante="perigo" tamanho="sm" onClick={() => aoCancelar(motivo)}>
            <X size={15} />
            Cancelar{venda.paga ? " e estornar o caixa" : ""}
          </Botao>
        </div>
      )}

      <Botao variante="fantasma" tamanho="md" larguraTotal onClick={aoApagar}>
        <Trash2 size={16} />
        Apagar este pedido
      </Botao>
    </div>
  );
}

/* ------------------------------------------------------- colar do grupo */

type Decisao = { tipo: "novo" } | { tipo: "venda"; venda: Venda };

function PainelColagem({
  vendas,
  diaId,
  dataAtual,
  aoAplicar,
  aoMudarData,
}: {
  vendas: Venda[];
  diaId: string;
  dataAtual: string;
  aoAplicar: (alteradas: Venda[], novas: Venda[]) => void;
  aoMudarData: (data: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [propostas, setPropostas] = useState<PropostaLinha[] | null>(null);
  const [semNumero, setSemNumero] = useState<string[]>([]);
  const [marcados, setMarcados] = useState<Record<number, boolean>>({});
  const [decisoes, setDecisoes] = useState<Record<number, Decisao>>({});
  const [dataLida, setDataLida] = useState<string | null>(null);

  function conferir() {
    const leitura = parsearMensagem(texto);
    if (!leitura.linhas.length) {
      toast.error("Não encontrei nenhum pedido", { description: "O formato é Nome 2, Nome 1 PG…" });
      return;
    }
    const lista = conferirMensagem(leitura.linhas, vendas);
    setPropostas(lista);
    setSemNumero(leitura.semNumero);
    setDataLida(leitura.data);
    setMarcados(Object.fromEntries(lista.map((p, i) => [i, p.tipo !== "igual"])));
    setDecisoes(
      Object.fromEntries(
        lista.flatMap((p, i) => (p.tipo === "duvidoso" && p.opcoes?.length ? [[i, { tipo: "venda", venda: p.opcoes[0] }] as const] : [])),
      ),
    );
    if (leitura.data && leitura.data !== dataAtual) {
      const alvo = leitura.data;
      toast(`A mensagem é de ${diaDaSemana(alvo)}, ${dataCurta(alvo)}`, {
        action: { label: "Abrir esse dia", onClick: () => aoMudarData(alvo) },
        duration: 7000,
      });
    }
  }

  const contagem = useMemo(() => {
    const c = { novo: 0, ajustar: 0, extra: 0, igual: 0, duvidoso: 0 };
    propostas?.forEach((p) => (c[p.tipo] += 1));
    return c;
  }, [propostas]);

  function aplicarTudo() {
    if (!propostas) return;
    const novas: Venda[] = [];
    const alteradas: Venda[] = [];

    propostas.forEach((p, i) => {
      if (!marcados[i] || p.tipo === "igual") return;
      const decisao: Decisao | undefined = p.tipo === "duvidoso" ? decisoes[i] : undefined;

      if (p.tipo === "novo" || p.tipo === "extra" || decisao?.tipo === "novo") {
        novas.push({
          id: uid("ven"),
          diaId,
          cliente: nomeParaExibir(p.linha.cliente),
          qtd: (p.tipo === "extra" ? p.qtdNova : p.linha.qtd) || 1,
          pg: p.linha.pg,
          paga: false,
          valorPago: null,
          valorUnit: null,
          acrescimo: 0,
          entreguePor: null,
          status: "pendente",
          obs: p.linha.obs,
          ordem: 0,
        });
        return;
      }

      const destino = decisao?.tipo === "venda" ? decisao.venda : p.venda;
      if (!destino) return;
      alteradas.push({
        ...destino,
        qtd: destino.qtd + p.linha.qtd,
        pg: destino.pg || p.linha.pg,
        obs: destino.obs || p.linha.obs,
        valorPago: destino.paga ? destino.valorPago : null,
      });
    });

    if (!novas.length && !alteradas.length) {
      toast.info("Nada marcado para aplicar");
      return;
    }
    aoAplicar(alteradas, novas);
  }

  if (!propostas) {
    return (
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-[13px] leading-relaxed text-tinta-2">
          Copie o texto do grupo e cole aqui. Eu leio linha por linha, somo as quantidades (
          <span className="font-mono text-[12px]">2 + 1</span> vira 3), reconheço{" "}
          <span className="font-semibold text-preparada-ink">PG</span> e comparo com o que já está lançado.
        </p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={"Marmitas Sábado 31/10\nLaura 2\nLudmila 1\nPaula 2 PG\nGessy 2 + 1"}
          className="min-h-[240px] w-full resize-none rounded-2xl border border-line bg-white p-4 font-mono text-[13px] leading-relaxed shadow-dentro placeholder:text-tinta-3 focus:border-brand focus:ring-4 focus:ring-brand/10 focus:outline-none"
        />
        <Botao variante="primario" tamanho="lg" larguraTotal onClick={conferir} disabled={!texto.trim()}>
          <Sparkles size={17} />
          Conferir {texto.trim() ? `· ${texto.split(/\r?\n/).filter((l) => l.trim()).length} linhas` : ""}
        </Botao>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-2">
      <div className="grid grid-cols-4 gap-2">
        <Resuminho cor="text-entregue" valor={contagem.novo + contagem.extra} rotulo="novos" />
        <Resuminho cor="text-preparada-ink" valor={contagem.ajustar} rotulo="somar" />
        <Resuminho cor="text-tinta-3" valor={contagem.igual} rotulo="iguais" />
        <Resuminho cor="text-cancelada" valor={contagem.duvidoso} rotulo="decidir" />
      </div>

      {dataLida && (
        <p className="rounded-xl bg-brand-soft px-3 py-2 text-[12px] font-semibold text-brand">
          Data lida na mensagem: {diaDaSemana(dataLida)}, {dataCurta(dataLida)}
        </p>
      )}

      <motion.ul variants={listaStagger} initial="oculto" animate="visivel" className="flex flex-col gap-2">
        {propostas.map((p, i) => {
          const decisao = decisoes[i];
          const destino = decisao?.tipo === "venda" ? decisao.venda : p.venda;
          return (
            <motion.li key={`${p.linha.bruto}-${i}`} variants={itemLista} className="card flex items-start gap-3 p-2.5">
              <button
                onClick={() => setMarcados((m) => ({ ...m, [i]: !m[i] }))}
                disabled={p.tipo === "igual"}
                aria-label={marcados[i] ? "Desmarcar" : "Marcar"}
                className={cn(
                  "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border-2 transition-colors",
                  marcados[i] ? "border-entregue bg-entregue text-white" : "border-line bg-white text-transparent",
                  p.tipo === "igual" && "opacity-40",
                )}
              >
                <Check size={16} />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-tinta">{nomeParaExibir(p.linha.cliente)}</span>
                  {p.linha.pg && <Chip className="border-gold-300 bg-gold-soft text-preparada-ink">PG</Chip>}
                </div>
                <p className="truncate text-[11px] text-tinta-3">
                  {p.tipo === "novo" && "entra como pedido novo"}
                  {p.tipo === "ajustar" && `já tem ${p.qtdAtual} → vai para ${p.qtdNova}`}
                  {p.tipo === "extra" &&
                    `as ${p.qtdAtual} ${p.venda?.status} ficam como estão · ${p.qtdNova} lançadas em separado`}
                  {p.tipo === "igual" && "já está lançado com a mesma quantidade"}
                  {p.tipo === "duvidoso" && "nome parecido, escolha abaixo"}
                </p>
                {p.tipo === "duvidoso" && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(p.opcoes ?? []).map((opcao) => (
                      <button
                        key={opcao.id}
                        onClick={() => setDecisoes((d) => ({ ...d, [i]: { tipo: "venda", venda: opcao } }))}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                          decisao?.tipo === "venda" && decisao.venda.id === opcao.id
                            ? "border-brand bg-brand text-crema"
                            : "border-line bg-white text-tinta-2",
                        )}
                      >
                        {opcao.cliente} · {opcao.qtd}
                      </button>
                    ))}
                    <button
                      onClick={() => setDecisoes((d) => ({ ...d, [i]: { tipo: "novo" } }))}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                        decisao?.tipo === "novo" ? "border-entregue bg-entregue/12 text-entregue-ink" : "border-line bg-white text-tinta-2",
                      )}
                    >
                      criar novo
                    </button>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="num rounded-full bg-crema-2 px-2.5 py-1 text-[14px] font-bold text-brand">×{p.linha.qtd}</span>
                {destino && marcados[i] && p.tipo !== "igual" && p.tipo !== "extra" && decisao?.tipo !== "novo" && (
                  <span className="num text-[11px] font-semibold text-entregue">{destino.qtd}→{destino.qtd + p.linha.qtd}</span>
                )}
              </div>
            </motion.li>
          );
        })}
      </motion.ul>

      {semNumero.length > 0 && (
        <details className="card p-3 text-[12px] text-tinta-2">
          <summary className="cursor-pointer list-none font-semibold text-brand">
            <ChevronDown size={14} className="mr-1 inline" />
            {semNumero.length} linha(s) sem quantidade — lance pelo botão Avulso
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {semNumero.map((l, i) => (
              <li key={i} className="truncate rounded-lg bg-crema-2 px-2 py-1 font-mono text-[11px]">{l}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex gap-2 pt-1">
        <Botao variante="neutro" tamanho="lg" onClick={() => setPropostas(null)}>
          <X size={16} />
          Voltar
        </Botao>
        <Botao variante="dourado" tamanho="lg" className="flex-1" onClick={aplicarTudo}>
          <Check size={17} />
          Aplicar marcados
        </Botao>
      </div>
    </div>
  );
}

function Resuminho({ cor, valor, rotulo }: { cor: string; valor: number; rotulo: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 py-2">
      <NumeroAnimado valor={valor} className={cn("text-[19px] font-bold leading-none", cor)} />
      <span className="text-[10px] font-semibold uppercase tracking-wide text-tinta-3">{rotulo}</span>
    </div>
  );
}

/* ----------------------------------------------------------- avulso */

function FormAvulso({
  diaId,
  preco,
  aoSalvar,
}: {
  diaId: string;
  preco: number;
  aoSalvar: (venda: Venda) => void;
}) {
  const [nome, setNome] = useState("");
  const [qtd, setQtd] = useState("1");
  const [pg, setPg] = useState(false);
  const [valorUnit, setValorUnit] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");

  const unidades = Math.max(1, Number(qtd) || 1);
  const unit = valorUnit.trim() ? paraNumero(valorUnit) : null;
  const total = unidades * (unit ?? preco);

  return (
    <div className="flex flex-col gap-3 pb-2">
      <Campo rotulo="Nome do cliente" dica="ex.: Gessy" value={nome} erro={erro} onChange={(e) => { setNome(e.target.value); if (erro) setErro(""); }} />
      <div className="flex items-end gap-3">
        <Campo rotulo="Quantidade" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, ""))} className="w-28" />
        <Campo
          rotulo="Valor da marmita"
          inputMode="decimal"
          prefixo="R$"
          dica={preco > 0 ? texto(preco) : "opcional"}
          value={valorUnit}
          onChange={(e) => setValorUnit(e.target.value.replace(/[^\d,.]/g, ""))}
          className="flex-1"
        />
      </div>
      <button
        onClick={() => setPg((v) => !v)}
        aria-pressed={pg}
        className={cn("h-12 w-full rounded-2xl border-2 text-[14px] font-semibold transition-colors", pg ? "border-preparada bg-gold-soft text-preparada-ink" : "border-line bg-white text-tinta-3")}
      >
        PG — paga depois {pg && <Check size={14} className="ml-1 inline" />}
      </button>
      <Campo rotulo="Observação (opcional)" dica="ex.: sem cheiro verde" value={obs} onChange={(e) => setObs(e.target.value)} />
      {preco > 0 && (
        <p className="num rounded-xl bg-crema-2 px-3 py-2 text-[13px] font-semibold text-tinta-2">
          entra {moeda(total)} no dia {unit != null && "· valor próprio"}
        </p>
      )}
      <Botao
        variante="primario"
        tamanho="lg"
        larguraTotal
        onClick={() => {
          if (!nome.trim()) {
            setErro("Escreva o nome do cliente");
            return;
          }
          aoSalvar({
            id: uid("ven"),
            diaId,
            cliente: nomeParaExibir(nome.trim()),
            qtd: unidades,
            pg,
            paga: false,
            valorUnit: unit,
            acrescimo: 0,
            valorPago: null,
            entreguePor: null,
            status: "pendente",
            obs: obs.trim(),
            ordem: 0,
          });
          setNome("");
          setQtd("1");
          setPg(false);
          setValorUnit("");
          setObs("");
        }}
      >
        <Plus size={17} />
        Lançar no dia
      </Botao>
    </div>
  );
}

/* --------------------------------------------------------- gasto do dia */

interface RascunhoGasto {
  descricao: string;
  valor: number;
  categoriaId: string;
  forma: FormaPagamento;
  obs: string;
}

/** O que a Márcia compra no sábado e dura a semana inteira. */
const COMPRAS_RAPIDAS: { rotulo: string; categoria: string }[] = [
  { rotulo: "Arroz", categoria: "cat_arroz" },
  { rotulo: "Feijão", categoria: "cat_arroz" },
  { rotulo: "Carne", categoria: "cat_carne" },
  { rotulo: "Frango", categoria: "cat_carne" },
  { rotulo: "Legumes", categoria: "cat_mercado" },
  { rotulo: "Óleo", categoria: "cat_mercado" },
  { rotulo: "Gás", categoria: "cat_gas" },
  { rotulo: "Embalagem", categoria: "cat_embalagem" },
];

function FormGasto({ categorias, aoSalvar }: { categorias: Categoria[]; aoSalvar: (gasto: RascunhoGasto) => void }) {
  const [descricao, setDescricao] = useState("");
  const [valorTexto, setValorTexto] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "cat_mercado");
  const [forma, setForma] = useState<FormaPagamento>("dinheiro");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");

  const valor = paraNumero(valorTexto);

  return (
    <div className="flex flex-col gap-3 pb-2">
      <Campo
        rotulo="O que foi comprado"
        dica="ex.: 5kg de arroz"
        value={descricao}
        erro={erro}
        onChange={(e) => {
          setDescricao(e.target.value);
          if (erro) setErro("");
        }}
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {COMPRAS_RAPIDAS.map((c) => (
          <button
            key={c.rotulo}
            onClick={() => {
              setDescricao(c.rotulo);
              setCategoriaId(c.categoria);
              if (erro) setErro("");
            }}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
              normalizar(descricao) === normalizar(c.rotulo)
                ? "border-brand bg-brand text-crema"
                : "border-line bg-white text-tinta-2",
            )}
          >
            {c.rotulo}
          </button>
        ))}
      </div>

      <Campo
        rotulo="Valor pago"
        inputMode="decimal"
        prefixo="R$"
        dica="0,00"
        value={valorTexto}
        onChange={(e) => setValorTexto(e.target.value.replace(/[^\d,.]/g, ""))}
      />

      <div className="flex flex-col gap-1.5">
        <p className="pl-1 text-[13px] font-semibold text-tinta-2">Categoria</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoriaId(c.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                categoriaId === c.id ? "border-saida bg-saida/12 text-saida" : "border-line bg-white text-tinta-2",
              )}
            >
              {c.emoji} {c.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FORMAS.map((f) => (
          <button
            key={f.valor}
            onClick={() => setForma(f.valor)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
              forma === f.valor ? "border-brand bg-brand text-crema" : "border-line bg-white text-tinta-2",
            )}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      <Campo rotulo="Observação (opcional)" dica="ex.: era para a semana toda" value={obs} onChange={(e) => setObs(e.target.value)} />

      <Botao
        variante="primario"
        tamanho="lg"
        larguraTotal
        disabled={valor <= 0}
        onClick={() => {
          if (!descricao.trim()) {
            setErro("Escreva o que foi comprado");
            vibrar([10, 40, 10]);
            return;
          }
          if (valor <= 0) {
            setErro("Digite o valor");
            return;
          }
          aoSalvar({ descricao: descricao.trim(), valor, categoriaId, forma, obs: obs.trim() });
        }}
      >
        <CircleDollarSign size={17} />
        {valor > 0 ? `Lançar ${moeda(valor)} de gasto` : "Lançar gasto"}
      </Botao>
    </div>
  );
}
