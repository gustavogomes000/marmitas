import { Fragment, useCallback, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronRight, Minus, PiggyBank, Plus, RotateCcw, Trash2, Wallet } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Categoria, Fluxo, FormaPagamento, Movimentacao } from "@/domain/types";
import {
  Barra,
  Botao,
  Campo,
  Cartao,
  Chip,
  Esqueleto,
  NumeroAnimado,
  Sheet,
  TecladoNumero,
  TituloSecao,
  Vazio,
} from "@/shared/components/ui";
import {
  useCategorias,
  useDia,
  useMovimentacoes,
  useRemoverMovimentacao,
  useSalvarMovimentacao,
} from "@/shared/hooks/useDados";
import { vibrar } from "@/shared/hooks/useAnimacao";
import { cn } from "@/shared/lib/cn";
import { dataCurta, hojeISO, moeda, paraISO, paraNumero, rotuloRelativo } from "@/shared/lib/format";
import { MOLINHO, SUAVE, apertar, itemLista, listaStagger, subir } from "@/shared/lib/motion";
import { uid } from "@/shared/lib/storage";

type Periodo = "hoje" | "sete" | "trinta" | "tudo";

const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "sete", rotulo: "7 dias" },
  { id: "trinta", rotulo: "30 dias" },
  { id: "tudo", rotulo: "Tudo" },
];

const FORMAS: { id: FormaPagamento; rotulo: string }[] = [
  { id: "pix", rotulo: "Pix" },
  { id: "dinheiro", rotulo: "Dinheiro" },
  { id: "cartao", rotulo: "Cartão" },
  { id: "outro", rotulo: "Outro" },
];

const DIAS_MS = 86_400_000;
const SALDO_ID = "mov_saldo_inicial";
const TUDO_DE = "1970-01-01";
const TUDO_ATE = "2999-12-31";

function intervalo(periodo: Periodo): { de: string; ate: string } {
  const hoje = hojeISO();
  if (periodo === "hoje") return { de: hoje, ate: hoje };
  if (periodo === "sete") return { de: paraISO(new Date(Date.now() - 6 * DIAS_MS)), ate: hoje };
  if (periodo === "trinta") return { de: paraISO(new Date(Date.now() - 29 * DIAS_MS)), ate: hoje };
  return { de: TUDO_DE, ate: TUDO_ATE };
}

function rotuloForma(forma: FormaPagamento): string {
  return FORMAS.find((f) => f.id === forma)?.rotulo ?? "Outro";
}

function textoDoValor(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}

export function TelaCaixa() {
  const [periodo, setPeriodo] = useState<Periodo>("sete");
  const { de, ate } = useMemo(() => intervalo(periodo), [periodo]);
  const hoje = useMemo(() => hojeISO(), []);

  const caixa = useMovimentacoes(TUDO_DE, TUDO_ATE);
  const historico = useMovimentacoes(de, ate);
  const diaDeHoje = useDia(hoje);
  const categorias = useCategorias();
  const qc = useQueryClient();

  const [painel, setPainel] = useState<Painel | null>(null);
  const [saldo, setSaldo] = useState<{ aberto: boolean; seq: number }>({ aberto: false, seq: 0 });

  const recarregar = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["movimentacoes"] });
  }, [qc]);

  function abrir(fluxo: Fluxo, edicao?: Movimentacao) {
    setPainel((atual) => ({ dados: { fluxo, edicao }, seq: (atual?.seq ?? 0) + 1, aberto: true }));
  }

  function fechar() {
    setPainel((atual) => (atual ? { ...atual, aberto: false } : null));
  }

  function abrirSaldo() {
    setSaldo((atual) => ({ aberto: true, seq: atual.seq + 1 }));
  }

  function fecharSaldo() {
    setSaldo((atual) => ({ ...atual, aberto: false }));
  }

  const porId = useMemo(() => {
    const mapa = new Map<string, Categoria>();
    for (const c of categorias.data ?? []) mapa.set(c.id, c);
    return mapa;
  }, [categorias.data]);

  const tudo = useMemo(() => caixa.data ?? [], [caixa.data]);

  const caixaTotais = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let recebiHoje = 0;
    let gasteiHoje = 0;
    for (const m of tudo) {
      if (m.fluxo === "entrada") {
        entradas += m.valor;
        if (m.data === hoje) recebiHoje += m.valor;
      } else {
        saidas += m.valor;
        if (m.data === hoje) gasteiHoje += m.valor;
      }
    }
    return { entradas, saidas, saldo: entradas - saidas, recebiHoje, gasteiHoje };
  }, [tudo, hoje]);

  const saldoInicial = useMemo(() => tudo.find((m) => m.id === SALDO_ID), [tudo]);
  const aReceber = diaDeHoje.data?.totais.aReceber ?? 0;
  const ficoHoje = caixaTotais.saldo + aReceber;

  const lista = useMemo(() => historico.data ?? [], [historico.data]);

  const gastos = useMemo(() => {
    const soma = new Map<string, number>();
    for (const m of lista) {
      if (m.fluxo !== "saida") continue;
      soma.set(m.categoriaId, (soma.get(m.categoriaId) ?? 0) + m.valor);
    }
    return [...soma.entries()]
      .map(([categoriaId, valor]) => ({ categoriaId, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  }, [lista]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Movimentacao[]>();
    for (const m of lista) {
      const itens = mapa.get(m.data);
      if (itens) itens.push(m);
      else mapa.set(m.data, [m]);
    }
    return [...mapa.entries()].map(([data, itens]) => ({
      data,
      itens,
      liquido: itens.reduce((s, m) => s + (m.fluxo === "entrada" ? m.valor : -m.valor), 0),
    }));
  }, [lista]);

  const maximoGasto = gastos[0]?.valor ?? 0;
  const rotuloPeriodo = PERIODOS.find((p) => p.id === periodo)?.rotulo ?? "";

  return (
    <div className="flex flex-col gap-4">
      <motion.section
        variants={subir}
        initial="oculto"
        animate="visivel"
        className="rounded-[22px] bg-gradient-to-br from-brand via-brand-600 to-gold p-5 text-crema shadow-elevado"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-crema/75">Dinheiro no caixa</p>
        {caixa.isError ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-crema/90">
              Não carregou o total do caixa.
            </p>
            <Botao
              variante="dourado"
              tamanho="sm"
              carregando={caixa.isFetching}
              onClick={() => void caixa.refetch()}
              className="shrink-0 gap-1.5"
            >
              <RotateCcw size={13} />
              Tentar de novo
            </Botao>
          </div>
        ) : caixa.isLoading ? (
          <div className="mt-2 h-12 w-52 max-w-full rounded-2xl bg-crema/15" />
        ) : (
          <motion.h1
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...MOLINHO, delay: 0.08 }}
            className="mt-1.5 min-w-0 font-display text-[clamp(2rem,11vw,2.9rem)] font-semibold leading-none"
          >
            <NumeroAnimado valor={caixaTotais.saldo} formatar={moeda} className="text-crema" />
          </motion.h1>
        )}
        <p className="mt-2 text-[11.5px] leading-snug text-crema/75">
          Total de tudo que já entrou e saiu, do começo até hoje. Não muda ao trocar o período.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Marcador rotulo="Entradas" valor={caixaTotais.entradas} ponto="bg-entregue" />
          <Marcador rotulo="Saídas" valor={caixaTotais.saidas} ponto="bg-saida" />
        </div>
      </motion.section>

      <motion.div variants={subir} initial="oculto" animate="visivel">
        <AnimatePresence mode="wait" initial={false}>
          {saldoInicial ? (
            <motion.div key="saldo-existente" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={SUAVE}>
              <Botao
                variante="neutro"
                onClick={abrirSaldo}
                className="flex w-full items-center justify-between gap-3 border-gold/50 bg-gold-soft px-3.5 py-3 text-left"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gold/20 text-gold-600">
                    <PiggyBank size={19} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-tinta">Saldo inicial</span>
                    <span className="flex items-center gap-1 text-[11.5px] text-tinta-3">
                      <CalendarDays size={12} />
                      em {dataCurta(saldoInicial.data)}
                    </span>
                  </span>
                </span>
                <span className="num shrink-0 whitespace-nowrap text-[15px] font-semibold text-entregue">
                  {moeda(saldoInicial.valor)}
                </span>
              </Botao>
            </motion.div>
          ) : (
            <motion.div key="saldo-novo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={SUAVE}>
              <Cartao className="flex items-center gap-3 border-gold/45 bg-gold-soft p-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gold/20 text-gold-600">
                  <PiggyBank size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-tinta">Ajustar saldo inicial</span>
                  <span className="block text-[11.5px] leading-snug text-tinta-2">
                    Quanto tinha no caixa/gaveta antes de começar a registrar.
                  </span>
                </span>
                <Botao variante="dourado" tamanho="sm" onClick={abrirSaldo} className="shrink-0 gap-1">
                  Definir
                  <ChevronRight size={15} />
                </Botao>
              </Cartao>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.section variants={subir} initial="oculto" animate="visivel">
        <TituloSecao>Hoje</TituloSecao>
        <Cartao className="mt-2 p-4">
          <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2.5">
            <LinhaValor rotulo="Recebi hoje" valor={caixaTotais.recebiHoje} cor="text-entregue" />
            <LinhaValor rotulo="Gastei hoje" valor={caixaTotais.gasteiHoje} cor="text-saida" />
            <LinhaValor rotulo="Falta receber (PG)" valor={aReceber} cor="text-paga" />
          </div>
          <div className="mt-3.5 flex items-center justify-between gap-2 rounded-2xl bg-brand/6 px-3.5 py-3 ring-1 ring-brand/15">
            <span className="min-w-0 truncate text-[12.5px] font-semibold uppercase tracking-[0.07em] text-brand">
              Com quanto fico hoje
            </span>
            <span className="num shrink-0 whitespace-nowrap font-display text-[clamp(1.15rem,5.6vw,1.4rem)] font-semibold text-brand">
              <NumeroAnimado valor={ficoHoje} formatar={moeda} />
            </span>
          </div>
        </Cartao>
      </motion.section>

      <div className="grid grid-cols-2 gap-2.5">
        <Botao variante="sucesso" tamanho="lg" onClick={() => abrir("entrada")} className="gap-2">
          <Plus size={20} strokeWidth={2.6} />
          Entrada
        </Botao>
        <Botao variante="perigo" tamanho="lg" onClick={() => abrir("saida")} className="gap-2">
          <Minus size={20} strokeWidth={2.6} />
          Saída
        </Botao>
      </div>

      <div className="flex gap-1 rounded-full border border-line bg-white p-1 shadow-suave">
        {PERIODOS.map((p) => {
          const ativo = p.id === periodo;
          return (
            <Botao
              key={p.id}
              variante="fantasma"
              tamanho="sm"
              onClick={() => setPeriodo(p.id)}
              className={cn(
                "relative min-h-11 flex-1 rounded-full text-[13px] font-semibold",
                ativo ? "text-crema" : "text-tinta-2",
              )}
            >
              {ativo && (
                <motion.span
                  layoutId="piloto-periodo"
                  transition={MOLINHO}
                  className="absolute inset-0 rounded-full bg-brand"
                />
              )}
              <span className="relative">{p.rotulo}</span>
            </Botao>
          );
        })}
      </div>
      <p className="-mt-2 px-1 text-[11.5px] text-tinta-3">O período muda só o histórico abaixo.</p>

      {gastos.length > 0 && (
        <motion.section variants={subir} initial="oculto" animate="visivel" className="flex flex-col gap-2.5">
          <TituloSecao>Gasto por categoria</TituloSecao>
          <Cartao className="flex flex-col gap-3.5 p-4">
            {gastos.map((g, i) => {
              const categoria = porId.get(g.categoriaId);
              const parcela = maximoGasto > 0 ? g.valor / maximoGasto : 0;
              return (
                <motion.div
                  key={g.categoriaId}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SUAVE, delay: i * 0.06 }}
                  className="flex flex-col gap-1.5"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 text-base leading-none">{categoria?.emoji ?? "🧾"}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-tinta">
                      {categoria?.nome ?? "Sem categoria"}
                    </span>
                    <span className="num shrink-0 text-[13px] font-semibold text-saida">{moeda(g.valor)}</span>
                  </div>
                  <Barra
                    altura="h-2"
                    partes={[
                      { valor: parcela, cor: "bg-gradient-to-r from-brand-500 to-saida", chave: g.categoriaId },
                      { valor: Math.max(0, 1 - parcela), cor: "bg-transparent", chave: "folga" },
                    ]}
                  />
                </motion.div>
              );
            })}
          </Cartao>
        </motion.section>
      )}

      <section className="flex flex-col gap-2.5">
        <TituloSecao
          acao={<span className="num text-xs font-semibold text-tinta-3">{lista.length} lançamentos</span>}
        >
          <span className="min-w-0 truncate">Histórico — {rotuloPeriodo}</span>
        </TituloSecao>

        {historico.isError ? (
          <Cartao className="flex flex-col items-start gap-2.5 border-gold-300 bg-gold-soft p-4">
            <p className="text-[13px] font-semibold leading-snug text-preparada-ink">
              Não deu para carregar o histórico deste período. Verifique a internet e tente de novo.
            </p>
            <Botao
              variante="dourado"
              tamanho="sm"
              carregando={historico.isFetching}
              onClick={() => void historico.refetch()}
            >
              <RotateCcw size={15} />
              Tentar de novo
            </Botao>
          </Cartao>
        ) : historico.isLoading ? (
          <div className="flex flex-col gap-2">
            <Esqueleto className="h-8 w-36 rounded-full" />
            <Esqueleto className="h-14 rounded-2xl" />
            <Esqueleto className="h-14 rounded-2xl" />
            <Esqueleto className="h-14 rounded-2xl" />
          </div>
        ) : lista.length === 0 ? (
          <Cartao className="p-2">
            <Vazio
              icone={<Wallet size={26} />}
              titulo="Nada lançado ainda"
              descricao="Registre a primeira entrada ou saída deste período para ver o histórico se mover aqui."
              acao={
                <Botao variante="sucesso" tamanho="md" onClick={() => abrir("entrada")}>
                  <Plus size={18} strokeWidth={2.6} />
                  Somar entrada
                </Botao>
              }
            />
          </Cartao>
        ) : (
          grupos.map((grupo) => (
            <div key={grupo.data} className="flex flex-col">
              <div className="sticky top-[56px] z-20 flex items-center justify-between gap-2 bg-crema/92 px-1 py-1.5 backdrop-blur">
                <h3 className="truncate font-display text-[13px] font-semibold text-brand">
                  {rotuloRelativo(grupo.data)}
                </h3>
                <span
                  className={cn(
                    "num shrink-0 text-xs font-semibold",
                    grupo.liquido >= 0 ? "text-entregue" : "text-saida",
                  )}
                >
                  {grupo.liquido >= 0 ? "+" : "−"}
                  {moeda(Math.abs(grupo.liquido))}
                </span>
              </div>
              <motion.div variants={listaStagger} initial="oculto" animate="visivel" className="flex flex-col">
                <AnimatePresence initial={false}>
                  {grupo.itens.map((m) => (
                    <LinhaMovimentacao
                      key={m.id}
                      mov={m}
                      categoria={porId.get(m.categoriaId)}
                      aoAbrir={() => abrir(m.fluxo, m)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            </div>
          ))
        )}
      </section>

      {painel && (
        <PainelMovimentacao
          key={painel.seq}
          aberto={painel.aberto}
          edicao={painel.dados.edicao}
          fluxoInicial={painel.dados.fluxo}
          de={de}
          ate={ate}
          aoFechar={fechar}
          aoMutou={recarregar}
        />
      )}

      <PainelSaldoInicial
        key={saldo.seq}
        aberto={saldo.aberto}
        existente={saldoInicial}
        aoFechar={fecharSaldo}
        aoMutou={recarregar}
      />
    </div>
  );
}

/* --------------------------------------------------------------- conta dia */

function LinhaValor({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <Fragment>
      <span className={cn("num whitespace-nowrap text-right text-[15px] font-semibold", cor)}>
        <NumeroAnimado valor={valor} formatar={moeda} />
      </span>
      <span className="min-w-0 truncate text-[13px] font-medium text-tinta-2">{rotulo}</span>
    </Fragment>
  );
}

/* -------------------------------------------------------------------- hero */

function Marcador({ rotulo, valor, ponto }: { rotulo: string; valor: number; ponto: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-2xl bg-crema/12 px-3 py-2.5">
      <motion.span
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...MOLINHO, delay: 0.12 }}
        className={cn("size-2.5 shrink-0 rounded-full ring-2 ring-crema/30", ponto)}
      />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-crema/75">{rotulo}</p>
        <p className="truncate text-[15px] font-semibold text-crema">
          <NumeroAnimado valor={valor} formatar={moeda} />
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- linha */

function LinhaMovimentacao({
  mov,
  categoria,
  aoAbrir,
}: {
  mov: Movimentacao;
  categoria: Categoria | undefined;
  aoAbrir: () => void;
}) {
  const entrada = mov.fluxo === "entrada";
  const ehSaldo = mov.id === SALDO_ID;
  return (
    <motion.button
      type="button"
      layout
      variants={itemLista}
      initial="oculto"
      animate="visivel"
      exit="saindo"
      whileTap={apertar}
      onClick={aoAbrir}
      className={cn(
        "mt-2 flex min-h-14 w-full items-center gap-3 overflow-hidden rounded-2xl border border-line bg-white px-3 py-2.5",
        "text-left shadow-suave",
      )}
    >
      <span className={cn("size-2.5 shrink-0 rounded-full", entrada ? "bg-entregue" : "bg-saida")} />
      <span className="shrink-0 text-xl leading-none">{ehSaldo ? "🏦" : (categoria?.emoji ?? "🧾")}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-tinta">
          {ehSaldo ? "Saldo inicial" : mov.descricao || categoria?.nome || "Sem descrição"}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
          {ehSaldo && (
            <Chip className="border-gold/50 bg-gold-soft text-brand-ink">
              <PiggyBank size={11} />
              saldo inicial
            </Chip>
          )}
          <span className="min-w-0 truncate text-xs text-tinta-3">
            {ehSaldo
              ? `${categoria?.nome ?? "Outro"} · ${rotuloForma(mov.forma)} · toque para ajustar`
              : `${categoria?.nome ?? "Sem categoria"} · ${rotuloForma(mov.forma)}`}
          </span>
        </span>
      </span>
      <span className={cn("num shrink-0 whitespace-nowrap text-[15px] font-semibold", entrada ? "text-entregue" : "text-saida")}>
        {entrada ? "+" : "−"}
        {moeda(mov.valor)}
      </span>
    </motion.button>
  );
}

/* --------------------------------------------------------------------- chips */

function OpcaoChip({
  ativo,
  grupo,
  pilha = "bg-brand",
  textoPilha = "text-crema",
  onClick,
  children,
}: {
  ativo: boolean;
  grupo: string;
  pilha?: string;
  textoPilha?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Botao
      variante="fantasma"
      tamanho="sm"
      onClick={onClick}
      className={cn(
        "relative min-h-11 rounded-full border px-3.5 text-sm font-semibold",
        ativo ? cn("border-transparent", textoPilha) : "border-line bg-white text-tinta-2",
      )}
    >
      {ativo && (
        <motion.span
          layoutId={`piloto-${grupo}`}
          transition={MOLINHO}
          className={cn("absolute inset-0 rounded-full", pilha)}
        />
      )}
      <span className="relative">{children}</span>
    </Botao>
  );
}

/* -------------------------------------------------- peças comuns de formulário */

interface Abertura {
  fluxo: Fluxo;
  edicao?: Movimentacao;
}

interface Painel {
  dados: Abertura;
  seq: number;
  aberto: boolean;
}

function Rotulo({ children, dica }: { children: ReactNode; dica?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 pl-1">
      <p className="text-[13px] font-semibold text-tinta-2">{children}</p>
      {dica && <p className="truncate text-[11px] text-tinta-3">{dica}</p>}
    </div>
  );
}

function MensagemErro({ mensagem }: { mensagem?: string }) {
  return (
    <AnimatePresence>
      {mensagem && (
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="pl-1 text-xs font-semibold text-cancelada"
        >
          {mensagem}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function DisplayValor({
  valor,
  cor,
  aberto,
  erro,
  onClick,
}: {
  valor: number;
  cor: string;
  aberto: boolean;
  erro?: string;
  onClick: () => void;
}) {
  return (
    <Botao
      variante="neutro"
      onClick={onClick}
      className={cn(
        "min-h-[74px] w-full rounded-3xl border-2 px-4",
        erro ? "border-cancelada" : aberto ? "border-brand" : "border-line",
      )}
      aria-label="Alterar teclado numérico"
    >
      <span className={cn("num font-display text-[clamp(1.7rem,9vw,2.3rem)] font-semibold leading-none", cor)}>
        {moeda(valor)}
      </span>
    </Botao>
  );
}

function TecladoRecolhido({ aberto, children }: { aberto: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {aberto && (
        <motion.div
          key="teclado"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={SUAVE}
          className="overflow-hidden"
        >
          <div className="rounded-3xl border border-line bg-crema-2 p-1">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SheetConteudo({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ ...SUAVE, delay: 0.04 }}
      className="flex flex-col gap-4 pb-2"
    >
      {children}
    </motion.div>
  );
}

function limparDigitacao(novo: string): string {
  const digitados = novo.replace(/[^\d,]/g, "");
  const temVirgula = digitados.includes(",");
  const [inteiraBruta = "", ...decimais] = digitados.split(",");
  const inteira = inteiraBruta.replace(/^0+(?=\d)/, "").slice(0, 8);
  return temVirgula ? `${inteira},${decimais.join("").slice(0, 2)}` : inteira;
}

/* ------------------------------------------------- painel de saldo inicial */

function PainelSaldoInicial({
  aberto,
  existente,
  aoFechar,
  aoMutou,
}: {
  aberto: boolean;
  existente?: Movimentacao;
  aoFechar: () => void;
  aoMutou: () => void;
}) {
  const salvar = useSalvarMovimentacao(TUDO_DE, TUDO_ATE);
  const remover = useRemoverMovimentacao(TUDO_DE, TUDO_ATE);
  const [valorTexto, setValorTexto] = useState(existente ? textoDoValor(existente.valor) : "");
  const [data, setData] = useState(existente?.data ?? hojeISO());
  const [tecladoAberto, setTecladoAberto] = useState(!existente);
  const [erro, setErro] = useState<string>();
  const [confirmando, setConfirmando] = useState(false);
  const valor = paraNumero(valorTexto);

  function gravar() {
    if (valorTexto.trim() === "") {
      setErro("Digite o valor (pode ser 0 para zerar)");
      vibrar([10, 40, 10]);
      return;
    }
    const centavos = Math.round(valor * 100) / 100;
    const mov: Movimentacao = {
      id: SALDO_ID,
      criadoEm: existente?.criadoEm ?? new Date().toISOString(),
      data,
      descricao: "Saldo inicial",
      obs: "",
      valor: centavos,
      fluxo: "entrada",
      categoriaId: "cat_outro_e",
      forma: "dinheiro",
    };
    salvar.mutate(mov, {
      onSuccess: () => {
        vibrar(12);
        toast.success(`Saldo inicial de ${moeda(centavos)} ajustado`);
        aoMutou();
        aoFechar();
      },
      onError: () => toast.error("Não salvou agora. Tente de novo."),
    });
  }

  function apagar() {
    remover.mutate(SALDO_ID, {
      onSuccess: () => {
        vibrar(20);
        toast.success("Saldo inicial removido");
        aoMutou();
        aoFechar();
      },
      onError: () => toast.error("Não removeu agora. Tente de novo."),
    });
  }

  const corpo = (
    <SheetConteudo>
      <p className="rounded-2xl bg-gold-soft px-3.5 py-3 text-[12.5px] leading-snug text-tinta-2">
        É quanto tinha no caixa ou na gaveta antes de começar a registrar as vendas e despesas. Some no total de
        hoje e fica marcado no histórico como <strong className="font-semibold text-brand">saldo inicial</strong>.
      </p>

      <div className="flex flex-col gap-2">
        <Rotulo dica="toque no valor para digitar">Valor no caixa</Rotulo>
        <DisplayValor
          valor={valor}
          cor={erro ? "text-cancelada" : "text-entregue"}
          aberto={tecladoAberto}
          erro={erro}
          onClick={() => setTecladoAberto((atual) => !atual)}
        />
        <MensagemErro mensagem={erro} />
        <TecladoRecolhido aberto={tecladoAberto}>
          <TecladoNumero
            valor={valorTexto}
            aoMudar={(novo) => {
              setValorTexto(limparDigitacao(novo));
              setErro(undefined);
            }}
            decimais
          />
        </TecladoRecolhido>
      </div>

      <Campo rotulo="Data do saldo" type="date" value={data} onChange={(e) => setData(e.target.value)} />
    </SheetConteudo>
  );

  const rodape = (
    <AnimatePresence mode="wait" initial={false}>
      {confirmando ? (
        <motion.div
          key="confirmar"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={SUAVE}
          className="flex flex-col gap-3 rounded-3xl border border-cancelada/30 bg-cancelada/8 p-4"
        >
          <p className="text-center text-sm font-semibold text-tinta">
            Remover o saldo inicial de {moeda(existente?.valor ?? valor)}? O total do caixa é recalculado.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Botao variante="neutro" tamanho="md" onClick={() => setConfirmando(false)}>
              Manter
            </Botao>
            <Botao variante="perigo" tamanho="md" onClick={apagar} carregando={remover.isPending}>
              <Trash2 size={17} />
              Confirmar
            </Botao>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="salvar"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={SUAVE}
          className="flex items-center gap-2"
        >
          {existente && (
            <Botao
              variante="neutro"
              tamanho="md"
              aria-label="Remover saldo inicial"
              onClick={() => setConfirmando(true)}
              className="w-13 shrink-0 px-0 text-saida"
            >
              <Trash2 size={19} />
            </Botao>
          )}
          <Botao variante="dourado" tamanho="lg" larguraTotal onClick={gravar} carregando={salvar.isPending}>
            {existente ? "Salvar saldo inicial" : "Definir saldo inicial"}
          </Botao>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <Sheet
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={existente ? "Ajustar saldo inicial" : "Definir saldo inicial"}
      rodape={rodape}
    >
      {corpo}
    </Sheet>
  );
}

/* ------------------------------------------------- painel de movimentação */

function PainelMovimentacao({
  aberto,
  edicao,
  fluxoInicial,
  de,
  ate,
  aoFechar,
  aoMutou,
}: {
  aberto: boolean;
  edicao?: Movimentacao;
  fluxoInicial: Fluxo;
  de: string;
  ate: string;
  aoFechar: () => void;
  aoMutou: () => void;
}) {
  const categorias = useCategorias();
  const salvarMov = useSalvarMovimentacao(de, ate);
  const removerMov = useRemoverMovimentacao(de, ate);

  const [fluxo, setFluxo] = useState<Fluxo>(edicao?.fluxo ?? fluxoInicial);
  const [valorTexto, setValorTexto] = useState(edicao ? textoDoValor(edicao.valor) : "");
  const [categoriaId, setCategoriaId] = useState(edicao?.categoriaId ?? "");
  const [forma, setForma] = useState<FormaPagamento>(edicao?.forma ?? "dinheiro");
  const [data, setData] = useState(edicao?.data ?? hojeISO());
  const [descricao, setDescricao] = useState(edicao?.descricao ?? "");
  const [obs, setObs] = useState(edicao?.obs ?? "");
  const [tecladoAberto, setTecladoAberto] = useState(!edicao);
  const [erroValor, setErroValor] = useState<string>();
  const [erroCategoria, setErroCategoria] = useState<string>();
  const [confirmando, setConfirmando] = useState(false);

  const doFluxo = (categorias.data ?? []).filter((c) => c.fluxo === fluxo);
  const valor = paraNumero(valorTexto);

  function trocarFluxo(novo: Fluxo) {
    setFluxo(novo);
    setCategoriaId((atual) => {
      const aindaServe = (categorias.data ?? []).some((c) => c.id === atual && c.fluxo === novo);
      return aindaServe ? atual : "";
    });
  }

  function confirmar() {
    const centavos = Math.round(valor * 100) / 100;
    const semValor = centavos <= 0;
    const semCategoria = !categoriaId;
    setErroValor(semValor ? "Digite um valor maior que zero" : undefined);
    setErroCategoria(semCategoria ? "Escolha uma categoria" : undefined);
    if (semValor || semCategoria) {
      vibrar([10, 40, 10]);
      return;
    }
    const ehSaldo = edicao?.id === SALDO_ID;
    const movimentacao: Movimentacao = {
      id: edicao?.id ?? uid("mov"),
      criadoEm: edicao?.criadoEm ?? new Date().toISOString(),
      data,
      descricao: ehSaldo ? "Saldo inicial" : descricao.trim(),
      obs: obs.trim(),
      valor: centavos,
      fluxo,
      categoriaId,
      forma,
    };
    salvarMov.mutate(movimentacao, {
      onSuccess: () => {
        vibrar(12);
        toast.success(
          edicao
            ? "Movimentação atualizada"
            : `${fluxo === "entrada" ? "Entrada" : "Saída"} de ${moeda(centavos)} lançada`,
        );
        aoMutou();
        aoFechar();
      },
      onError: () => toast.error("Não salvou agora. Confira a conexão e tente de novo."),
    });
  }

  function apagar() {
    if (!edicao) return;
    removerMov.mutate(edicao.id, {
      onSuccess: () => {
        vibrar(20);
        toast.success("Movimentação apagada");
        aoMutou();
        aoFechar();
      },
      onError: () => toast.error("Não apagou agora. Tente de novo."),
    });
  }

  const corpo = (
    <SheetConteudo>
      <div className="flex gap-1 rounded-2xl border border-line bg-white p-1">
        {(["entrada", "saida"] as Fluxo[]).map((opcao) => {
          const ativo = fluxo === opcao;
          return (
            <Botao
              key={opcao}
              variante="fantasma"
              tamanho="sm"
              onClick={() => trocarFluxo(opcao)}
              className={cn(
                "relative min-h-11 flex-1 rounded-xl text-sm font-semibold",
                ativo ? (opcao === "entrada" ? "text-entregue" : "text-saida") : "text-tinta-3",
              )}
            >
              {ativo && (
                <motion.span
                  layoutId="piloto-fluxo"
                  transition={MOLINHO}
                  className={cn(
                    "absolute inset-0 rounded-xl",
                    opcao === "entrada" ? "bg-entregue/12" : "bg-saida/12",
                  )}
                />
              )}
              <span className="relative">{opcao === "entrada" ? "Entrada" : "Saída"}</span>
            </Botao>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <Rotulo dica="toque no valor para digitar">Valor</Rotulo>
        <DisplayValor
          valor={valor}
          cor={fluxo === "entrada" ? "text-entregue" : "text-saida"}
          aberto={tecladoAberto}
          erro={erroValor}
          onClick={() => setTecladoAberto((atual) => !atual)}
        />
        <MensagemErro mensagem={erroValor} />
        <TecladoRecolhido aberto={tecladoAberto}>
          <TecladoNumero
            valor={valorTexto}
            aoMudar={(novo) => {
              setValorTexto(limparDigitacao(novo));
              if (erroValor) setErroValor(undefined);
            }}
            decimais
          />
        </TecladoRecolhido>
      </div>

      <div className="flex flex-col gap-2">
        <Rotulo>Categoria</Rotulo>
        {categorias.isLoading ? (
          <Esqueleto className="h-24 rounded-2xl" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {doFluxo.map((c) => (
              <OpcaoChip
                key={c.id}
                grupo="categoria"
                ativo={c.id === categoriaId}
                onClick={() => {
                  setCategoriaId(c.id);
                  if (erroCategoria) setErroCategoria(undefined);
                }}
              >
                <span className="text-base leading-none">{c.emoji}</span>
                {c.nome}
              </OpcaoChip>
            ))}
          </div>
        )}
        <MensagemErro mensagem={erroCategoria} />
      </div>

      <div className="flex flex-col gap-2">
        <Rotulo>Forma de pagamento</Rotulo>
        <div className="flex flex-wrap gap-2">
          {FORMAS.map((f) => (
            <OpcaoChip
              key={f.id}
              grupo="forma"
              pilha="bg-gold"
              textoPilha="text-brand-ink"
              ativo={f.id === forma}
              onClick={() => setForma(f.id)}
            >
              {f.rotulo}
            </OpcaoChip>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <Campo
          rotulo="Descrição"
          dica="Ex.: mercado do bairro"
          value={descricao}
          maxLength={60}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </div>

      <Campo
        rotulo="Observação (opcional)"
        dica="Detalhe que vale a pena lembrar"
        value={obs}
        maxLength={120}
        onChange={(e) => setObs(e.target.value)}
      />
    </SheetConteudo>
  );

  const rodape = (
    <AnimatePresence mode="wait" initial={false}>
      {confirmando ? (
        <motion.div
          key="confirmar"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={SUAVE}
          className="flex flex-col gap-3 rounded-3xl border border-cancelada/30 bg-cancelada/8 p-4"
        >
          <p className="text-center text-sm font-semibold text-tinta">
            Apagar esta {fluxo === "entrada" ? "entrada" : "saída"} de {moeda(edicao?.valor ?? valor)}?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Botao variante="neutro" tamanho="md" onClick={() => setConfirmando(false)}>
              Manter
            </Botao>
            <Botao variante="perigo" tamanho="md" onClick={apagar} carregando={removerMov.isPending}>
              <Trash2 size={17} />
              Confirmar apagar
            </Botao>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="salvar"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={SUAVE}
          className="flex items-center gap-2"
        >
          {edicao && (
            <Botao
              variante="neutro"
              tamanho="md"
              aria-label="Apagar movimentação"
              onClick={() => setConfirmando(true)}
              className="w-13 shrink-0 px-0 text-saida"
            >
              <Trash2 size={19} />
            </Botao>
          )}
          <Botao
            variante={fluxo === "entrada" ? "sucesso" : "perigo"}
            tamanho="lg"
            larguraTotal
            onClick={confirmar}
            carregando={salvarMov.isPending}
          >
            {edicao ? "Salvar alterações" : fluxo === "entrada" ? "Somar entrada" : "Registrar saída"}
          </Botao>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <Sheet
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={edicao ? "Ajustar movimentação" : fluxo === "entrada" ? "Nova entrada" : "Nova saída"}
      rodape={rodape}
    >
      {corpo}
    </Sheet>
  );
}
