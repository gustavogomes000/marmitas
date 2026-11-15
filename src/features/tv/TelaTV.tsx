import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  BarChart3,
  ChefHat,
  CircleAlert,
  CircleCheck,
  Coins,
  Flame,
  LogOut,
  PackageCheck,
  Receipt,
  Truck,
  Users,
  Utensils,
  Wallet,
} from "lucide-react";
import { repo } from "@/data";
import type { Movimentacao, Venda } from "@/domain/types";
import { faltandoMontar } from "@/domain/totais";
import { APARENCIA, estaMontada } from "@/shared/lib/status";
import { chaves, useEntregadores } from "@/shared/hooks/useDados";
import { dataLonga, deISO, diaDaSemana, hojeISO, hora, moeda, paraISO } from "@/shared/lib/format";
import { MOLINHO, SUAVE, itemLista, listaStagger } from "@/shared/lib/motion";
import { cn } from "@/shared/lib/cn";
import { Barra, NumeroAnimado } from "@/shared/components/ui";
import { Marca, Simbolo } from "@/shared/components/Marca";

/* Cartões-herói do painel. Cada um rastreia o valor anterior com useRef e dá
   um flash dourado quando o número aumenta (movimento sutil, legível a 3m). */
interface CartaoHeroi {
  chave: string;
  rotulo: string;
  valor: number;
  icone: ReactNode;
  corBarra: string;
  corNumero: string;
  urgente?: boolean;
}

function CardHero({ rotulo, valor, icone, corBarra, corNumero, urgente }: CartaoHeroi) {
  const anterior = useRef(valor);
  const [pulso, setPulso] = useState(0);

  useEffect(() => {
    if (valor > anterior.current) setPulso((p) => p + 1);
    anterior.current = valor;
  }, [valor]);

  return (
    <motion.div
      variants={itemLista}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-gold/15 bg-brand/55 p-5 backdrop-blur-sm",
        "shadow-[0_20px_50px_-24px_rgba(0,0,0,0.9)]",
      )}
    >
      <span className={cn("absolute left-0 top-0 h-full w-1.5", corBarra)} aria-hidden />
      {urgente && (
        <span className="animate-pulsar-suave pointer-events-none absolute inset-0 rounded-3xl shadow-[0_0_54px_-6px_rgba(192,38,53,0.85)]" />
      )}
      {pulso > 0 && (
        <motion.span
          key={pulso}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 bg-gold"
          aria-hidden
        />
      )}

      <div className="relative flex items-start justify-between">
        <span className="text-crema/50">{icone}</span>
        {urgente && <CircleAlert className="text-cancelada" size={18} aria-hidden />}
      </div>

      <div className={cn("relative mt-1 leading-none", corNumero)}>
        <NumeroAnimado
          valor={valor}
          className="font-display font-semibold whitespace-nowrap text-[clamp(2.75rem,8.5vw,6.5rem)]"
        />
      </div>

      <p className="relative mt-3 text-[clamp(0.8rem,1.5vw,1.15rem)] font-semibold uppercase tracking-[0.2em] text-gold/80">
        {rotulo}
      </p>
    </motion.div>
  );
}

const UM_DIA = 86_400_000;
const TUDO_DE = "1970-01-01";
const TUDO_ATE = "2999-12-31";
const SEM_MOV: Movimentacao[] = [];

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.charAt(0) ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : "";
  return (primeira + ultima).toUpperCase() || "?";
}

function LinhaEntrega({
  nome,
  entrega,
  total,
  cor,
}: {
  nome: string;
  entrega: number;
  total: number;
  cor: string;
}) {
  const share = total > 0 ? Math.round((entrega / total) * 100) : 0;
  return (
    <motion.div variants={itemLista} className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold/15 text-[13px] font-bold text-gold ring-1 ring-gold/30">
        {iniciais(nome)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-display text-[clamp(1rem,2vw,1.35rem)] font-semibold">{nome}</p>
          <p className="num shrink-0 text-[clamp(0.95rem,1.9vw,1.25rem)] font-semibold text-crema">
            {entrega} <span className="text-crema/45">marmitas</span>
          </p>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1">
            <Barra
              altura="h-2"
              partes={[
                { valor: entrega, cor, chave: "feito" },
                { valor: Math.max(0, total - entrega), cor: "bg-crema/10", chave: "resto" },
              ]}
            />
          </div>
          <span className="num w-10 text-right text-xs font-semibold text-gold/80">{share}%</span>
        </div>
      </div>
    </motion.div>
  );
}

/** Dinheiro do dia + saldo real do caixa, legível de longe. */
function PainelDinheiro({
  saldo,
  recebido,
  aReceber,
  gasto,
  cobrancaAntiga,
}: {
  saldo: number;
  recebido: number;
  aReceber: number;
  gasto: number;
  cobrancaAntiga: number;
}) {
  const linhas: { chave: string; rotulo: string; valor: number; cor: string; icone: ReactNode }[] = [
    { chave: "saldo", rotulo: "Saldo em caixa", valor: saldo, cor: "text-gold", icone: <Wallet size={16} /> },
    { chave: "recebido", rotulo: "Recebido hoje", valor: recebido, cor: "text-entregue", icone: <Coins size={16} /> },
    { chave: "gasto", rotulo: "Gasto total", valor: gasto, cor: "text-cancelada", icone: <Receipt size={16} /> },
  ];
  return (
    <div className="rounded-3xl border border-gold/15 bg-brand/40 p-5 sm:p-6">
      <h2 className="font-display text-[clamp(1.1rem,2.6vw,1.6rem)] font-semibold text-gold">Dinheiro</h2>
      <motion.ul variants={listaStagger} initial="oculto" animate="visivel" className="mt-4 flex flex-col gap-3">
        {linhas.map((l) => (
          <motion.li
            key={l.chave}
            variants={itemLista}
            className="flex items-baseline justify-between gap-3 border-b border-gold/10 pb-2.5 last:border-0"
          >
            <span className="flex min-w-0 items-center gap-2 text-[clamp(0.85rem,1.7vw,1.1rem)] font-semibold text-crema/70">
              <span className="shrink-0 text-gold/70">{l.icone}</span>
              <span className="truncate">{l.rotulo}</span>
            </span>
            <span className={cn("num shrink-0 font-display text-[clamp(1.3rem,3.4vw,2.3rem)] font-bold", l.cor)}>
              {moeda(l.valor)}
            </span>
          </motion.li>
        ))}
      </motion.ul>

      {cobrancaAntiga > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-cancelada/15 px-4 py-3 ring-1 ring-cancelada/40">
          <p className="text-[clamp(0.85rem,1.8vw,1.1rem)] font-semibold">Cobranças de dias passados</p>
          <p className="num shrink-0 font-display text-[clamp(1.2rem,3.2vw,2rem)] font-bold text-gold">
            {moeda(cobrancaAntiga)}
          </p>
        </div>
      )}
      {aReceber > 0 && (
        <p className="num mt-3 text-right text-[clamp(0.85rem,1.8vw,1.15rem)] font-semibold text-crema/60">
          a receber do dia: {moeda(aReceber)}
        </p>
      )}
    </div>
  );
}

/** Marmitas vendidas por dia — mostra se a semana está subindo ou caindo. */
function PainelMarmitasDia({ barras }: { barras: { data: string; qtd: number; rotulo: string }[] }) {
  const max = Math.max(1, ...barras.map((b) => b.qtd));
  return (
    <div className="rounded-3xl border border-gold/15 bg-brand/40 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <BarChart3 size={18} className="text-gold" />
        <h2 className="font-display text-[clamp(1.1rem,2.6vw,1.6rem)] font-semibold">Marmitas por dia</h2>
      </div>
      <motion.div
        variants={listaStagger}
        initial="oculto"
        animate="visivel"
        className="mt-5 flex items-end justify-between gap-2 sm:gap-3"
        style={{ height: "clamp(96px, 14vh, 168px)" }}
      >
        {barras.map((b) => (
          <motion.div
            key={b.data}
            variants={itemLista}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
          >
            <span className="num text-[clamp(0.8rem,1.6vw,1.1rem)] font-bold text-crema/80">{b.qtd}</span>
            <div
              className={cn(
                "w-full rounded-t-lg",
                b.data === barras[barras.length - 1]?.data ? "bg-gold" : "bg-gold/30",
              )}
              style={{ height: `${Math.max(4, (b.qtd / max) * 100)}%` }}
            />
            <span className="w-full truncate text-center text-[clamp(0.65rem,1.3vw,0.9rem)] font-semibold uppercase tracking-[0.08em] text-crema/50">
              {b.rotulo}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

export function TelaTV() {
  const hoje = hojeISO();

  const [agora, setAgora] = useState(() => new Date().toISOString());
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date().toISOString()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: resumo } = useQuery({
    queryKey: chaves.dia(hoje),
    queryFn: () => repo.vendasDoDia(hoje),
    refetchInterval: 5000,
  });
  const { data: entregadores } = useEntregadores();

  const { data: movimentos } = useQuery({
    queryKey: chaves.movimentacoes(TUDO_DE, TUDO_ATE),
    queryFn: () => repo.movimentacoes(TUDO_DE, TUDO_ATE),
    refetchInterval: 15000,
  });
  const { data: abertos } = useQuery({
    queryKey: ["vendas-em-aberto", hoje],
    queryFn: () => repo.vendasEmAberto(hoje),
    refetchInterval: 15000,
  });
  const semanaDe = useMemo(() => paraISO(new Date(deISO(hoje).getTime() - 6 * UM_DIA)), [hoje]);
  const { data: resumos } = useQuery({
    queryKey: [...chaves.dias(semanaDe, hoje), "resumo"],
    queryFn: () => repo.resumosPeriodo(semanaDe, hoje),
    refetchInterval: 15000,
  });

  const vendas = resumo?.vendas ?? [];
  const totais = resumo?.totais;
  const semCanceladas = useMemo(() => vendas.filter((v) => v.status !== "cancelada"), [vendas]);

  const nomesEntregadores = useMemo(
    () => new Map((entregadores ?? []).map((e) => [e.id, e.nome] as const)),
    [entregadores],
  );

  const montadas = semCanceladas.filter((v) => estaMontada(v.status)).reduce((s, v) => s + v.qtd, 0);
  const faltam = resumo ? faltandoMontar(resumo.vendas) : 0;

  const percentualMontado = totais && totais.marmitas > 0 ? Math.round((montadas / totais.marmitas) * 100) : 0;
  const clientes = new Set(semCanceladas.map((v) => v.cliente)).size;
  const mediaPorCliente = totais && clientes > 0 ? totais.marmitas / clientes : 0;

  const { linhasEntrega, semEntregador, totalEntregue } = useMemo(() => {
    const entregues = vendas.filter((v) => v.status === "entregue");
    const total = entregues.reduce((s, v) => s + v.qtd, 0);
    const sem = entregues.filter((v) => !v.entreguePor).reduce((s, v) => s + v.qtd, 0);
    const linhas = (entregadores ?? [])
      .map((e) => ({
        id: e.id,
        nome: e.nome,
        entrega: entregues.filter((v) => v.entreguePor === e.id).reduce((s, v) => s + v.qtd, 0),
      }))
      .filter((l) => l.entrega > 0)
      .sort((a, b) => b.entrega - a.entrega);
    return { linhasEntrega: linhas, semEntregador: sem, totalEntregue: total };
  }, [vendas, entregadores]);

  const caixa = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    for (const m of movimentos ?? SEM_MOV) {
      if (m.fluxo === "entrada") entradas += m.valor;
      else saidas += m.valor;
    }
    const cobrancaAntiga = (abertos ?? []).reduce((s, v) => s + v.valor, 0);
    return { saldo: entradas - saidas, gasto: saidas, cobrancaAntiga };
  }, [movimentos, abertos]);

  const barras = useMemo(
    () =>
      [...(resumos ?? [])]
        .sort((a, b) => (a.dia.data < b.dia.data ? -1 : 1))
        .slice(-7)
        .map((r) => ({
          data: r.dia.data,
          qtd: r.totais.marmitas,
          rotulo: diaDaSemana(r.dia.data).slice(0, 3),
        })),
    [resumos],
  );

  const ultimasEntregas = useMemo<Venda[]>(
    () =>
      vendas
        .filter((v) => v.status === "entregue")
        .sort((a, b) => b.ordem - a.ordem)
        .slice(0, 6),
    [vendas],
  );

  const dia = resumo ? dataLonga(hoje) : "";
  const soData = dia.split(", ")[1] ?? dia;
  const segundos = new Date(agora).getSeconds().toString().padStart(2, "0");

  const cards: CartaoHeroi[] = totais
    ? [
        {
          chave: "vendidas",
          rotulo: "Vendidas",
          valor: totais.marmitas,
          icone: <Utensils size={18} />,
          corBarra: "bg-gold",
          corNumero: "text-gold",
        },
        {
          chave: "montadas",
          rotulo: "Montadas",
          valor: montadas,
          icone: <PackageCheck size={18} />,
          corBarra: APARENCIA.preparada.barra,
          corNumero: "text-crema",
        },
        {
          chave: "entregues",
          rotulo: "Entregues",
          valor: totais.entregues,
          icone: <Truck size={18} />,
          corBarra: APARENCIA.entregue.barra,
          corNumero: "text-crema",
        },
        {
          chave: "faltam",
          rotulo: "Faltam",
          valor: faltam,
          icone: <ChefHat size={18} />,
          corBarra: faltam > 0 ? "bg-cancelada" : APARENCIA.entregue.barra,
          corNumero: faltam > 0 ? "text-gold" : "text-entregue",
          urgente: faltam > 0,
        },
      ]
    : [];

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-brand-ink text-crema">
      {/* brilho dourado radial sutil (peça de signage premium) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(65% 45% at 50% -8%, rgba(251,160,17,0.16), transparent 68%), radial-gradient(50% 45% at 100% 105%, rgba(82,16,17,0.55), transparent 72%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1750px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
        {/* ---------------------------------------------------------- topo */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <Marca />

          <div className="flex flex-col items-end gap-1">
            <a
              href="/dia"
              className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-crema/40 transition-colors hover:text-gold"
            >
              <LogOut size={12} /> sair do painel
            </a>
            <p className="text-[clamp(0.7rem,1.3vw,0.95rem)] font-semibold uppercase tracking-[0.28em] text-gold/70">
              {diaDaSemana(hoje)}
            </p>
            <p className="font-display text-[clamp(1rem,2.4vw,1.7rem)] font-semibold leading-none">
              {resumo ? soData : "—"}
            </p>
            {resumo?.dia.obs && (
              <p className="max-w-[22ch] truncate text-right font-script text-[clamp(1.1rem,2.6vw,1.9rem)] leading-none text-gold/85">
                {resumo.dia.obs}
              </p>
            )}
            {resumo?.dia.prato && (
              <p className="flex max-w-[30ch] items-center justify-end gap-2 truncate text-[clamp(0.85rem,1.6vw,1.15rem)] font-semibold text-crema/80">
                <Utensils size={16} className="shrink-0 text-gold/70" />
                <span className="truncate">{resumo.dia.prato}</span>
              </p>
            )}
            <p className="num mt-1 font-display text-[clamp(1.7rem,5vw,3.2rem)] font-bold leading-none text-gold">
              {hora(agora)}
              <span className="text-gold/50">:{segundos}</span>
            </p>
          </div>
        </header>

        {/* --------------------------------------------------- corpo / vazio */}
        {!resumo ? (
          <main className="grid flex-1 place-items-center py-16">
            <div className="flex flex-col items-center gap-4">
              <Simbolo tamanho={72} className="animate-pulsar-suave" />
              <p className="font-display text-[clamp(1.2rem,3vw,2rem)] font-semibold text-gold">
                Sincronizando o painel…
              </p>
            </div>
          </main>
        ) : resumo.vendas.length === 0 ? (
          <main className="grid flex-1 place-items-center py-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={MOLINHO}
              className="flex flex-col items-center gap-5 text-center"
            >
              <Simbolo tamanho={112} />
              <p className="font-display text-[clamp(1.6rem,5vw,3.4rem)] font-semibold text-gold">
                Nenhuma marmita lançada hoje
              </p>
              <p className="max-w-[40ch] text-[clamp(0.85rem,1.8vw,1.1rem)] text-crema/50">
                Assim que as vendas entrarem, o painel ganha vida e atualiza sozinho.
              </p>
            </motion.div>
          </main>
        ) : (
          <>
            {/* ------------------------------------------------ quatro heróis */}
            <motion.main
              variants={listaStagger}
              initial="oculto"
              animate="visivel"
              className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
            >
              {cards.map((c) => (
                <CardHero key={c.chave} {...c} />
              ))}
            </motion.main>

            {/* -------------------------------------- progresso + painéis */}
            <div className="grid flex-1 gap-6 lg:grid-cols-5">
              <section className="flex flex-col gap-6 lg:col-span-3">
                {/* barra do dia */}
                <div className="rounded-3xl border border-gold/15 bg-brand/40 p-5 sm:p-6">
                  <div className="flex items-end justify-between gap-4">
                    <h2 className="font-display text-[clamp(1.1rem,2.6vw,1.6rem)] font-semibold">Andamento do dia</h2>
                    <p className="leading-none">
                      <span className="num font-display text-[clamp(2rem,6vw,3.5rem)] font-bold text-gold">
                        <NumeroAnimado valor={percentualMontado} formatar={(n) => `${Math.round(n)}%`} />
                      </span>
                      <span className="ml-1 text-xs font-semibold uppercase tracking-[0.16em] text-crema/50">
                        montado
                      </span>
                    </p>
                  </div>

                  <div className="mt-4">
                    <Barra
                      altura="h-5"
                      partes={[
                        { valor: resumo.totais.entregues, cor: APARENCIA.entregue.barra, chave: "entregue" },
                        { valor: resumo.totais.preparadas, cor: APARENCIA.preparada.barra, chave: "preparada" },
                        { valor: resumo.totais.pendentes, cor: APARENCIA.pendente.barra, chave: "pendente" },
                      ]}
                    />
                  </div>

                  <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                    {(
                      [
                        ["entregue", "Entregue", resumo.totais.entregues],
                        ["preparada", "Preparada", resumo.totais.preparadas],
                        ["pendente", "Pendente", resumo.totais.pendentes],
                      ] as const
                    ).map(([chave, rotulo, valor]) => (
                      <li key={chave} className="flex items-center gap-2">
                        <span className={cn("size-3 rounded-full", APARENCIA[chave].ponto)} />
                        <span className="text-[clamp(0.8rem,1.6vw,1rem)] font-semibold text-crema/70">{rotulo}</span>
                        <span className="num text-[clamp(0.9rem,1.8vw,1.2rem)] font-bold">{valor}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* produção */}
                <div className="rounded-3xl border border-gold/15 bg-brand/40 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-gold">
                    <Flame size={18} />
                    <h2 className="font-display text-[clamp(1.1rem,2.6vw,1.6rem)] font-semibold text-gold">Produção</h2>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="num font-display text-[clamp(1.7rem,5vw,3rem)] font-bold leading-none">
                        <NumeroAnimado valor={resumo.totais.marmitas} />
                      </p>
                      <p className="mt-1 text-[clamp(0.75rem,1.5vw,0.95rem)] uppercase tracking-[0.16em] text-crema/50">
                        total marmitas
                      </p>
                    </div>
                    <div>
                      <p className="num font-display text-[clamp(1.7rem,5vw,3rem)] font-bold leading-none">
                        {mediaPorCliente.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                      </p>
                      <p className="mt-1 text-[clamp(0.75rem,1.5vw,0.95rem)] uppercase tracking-[0.16em] text-crema/50">
                        média por cliente
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "mt-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3",
                      faltam > 0 ? "bg-cancelada/15 ring-1 ring-cancelada/40" : "bg-entregue/12 ring-1 ring-entregue/30",
                    )}
                  >
                    <p className="text-[clamp(0.9rem,1.9vw,1.2rem)] font-semibold">Precisa montar ainda</p>
                    <p
                      className={cn(
                        "num font-display text-[clamp(1.6rem,5vw,2.8rem)] font-bold leading-none",
                        faltam > 0 ? "text-gold" : "text-entregue",
                      )}
                    >
                      <NumeroAnimado valor={faltam} />
                    </p>
                  </div>
                </div>

                {/* entregas por entregador */}
                <div className="rounded-3xl border border-gold/15 bg-brand/40 p-5 sm:p-6">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-gold" />
                    <h2 className="font-display text-[clamp(1.1rem,2.6vw,1.6rem)] font-semibold">Entregas por rotista</h2>
                  </div>
                  <motion.div variants={listaStagger} initial="oculto" animate="visivel" className="mt-4 flex flex-col gap-4">
                    {linhasEntrega.length === 0 && semEntregador === 0 ? (
                      <motion.p variants={itemLista} className="text-[clamp(0.9rem,1.8vw,1.1rem)] text-crema/45">
                        Nenhuma entrega concluída ainda.
                      </motion.p>
                    ) : (
                      <>
                        {linhasEntrega.map((l) => (
                          <LinhaEntrega key={l.id} nome={l.nome} entrega={l.entrega} total={totalEntregue} cor="bg-gold" />
                        ))}
                        {semEntregador > 0 && (
                          <LinhaEntrega
                            nome="Sem entregador"
                            entrega={semEntregador}
                            total={totalEntregue}
                            cor={APARENCIA.pendente.barra}
                          />
                        )}
                      </>
                    )}
                  </motion.div>
                </div>
              </section>

              {/* dinheiro + marmitas por dia + últimas entregas */}
              <section className="flex flex-col gap-6 lg:col-span-2">
                <PainelDinheiro
                  saldo={caixa.saldo}
                  recebido={totais?.recebido ?? 0}
                  aReceber={totais?.aReceber ?? 0}
                  gasto={caixa.gasto}
                  cobrancaAntiga={caixa.cobrancaAntiga}
                />
                {barras.length > 0 && <PainelMarmitasDia barras={barras} />}

                <div className="flex flex-1 flex-col rounded-3xl border border-gold/15 bg-brand/40 p-5 sm:p-6">
                  <div className="flex items-center gap-2">
                    <CircleCheck size={18} className="text-entregue" />
                    <h2 className="font-display text-[clamp(1.1rem,2.6vw,1.6rem)] font-semibold">Últimas entregas</h2>
                  </div>

                  {ultimasEntregas.length === 0 ? (
                    <p className="mt-6 text-[clamp(0.9rem,1.8vw,1.1rem)] text-crema/45">
                      Aguardando a primeira entrega do dia.
                    </p>
                  ) : (
                    <motion.ul
                      key={ultimasEntregas.map((v) => v.id).join("-")}
                      variants={listaStagger}
                      initial="oculto"
                      animate="visivel"
                      className="mt-4 flex flex-1 flex-col gap-3"
                    >
                      {ultimasEntregas.map((v) => (
                        <motion.li
                          key={v.id}
                          variants={itemLista}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-brand/45 px-4 py-3 ring-1 ring-gold/10"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className={cn("size-2.5 shrink-0 rounded-full", APARENCIA.entregue.ponto)} />
                            <span className="truncate font-display text-[clamp(1rem,2.2vw,1.4rem)] font-semibold">
                              {v.cliente}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            <span className="num text-[clamp(1rem,2.2vw,1.4rem)] font-bold text-gold">×{v.qtd}</span>
                            <span className="max-w-[10ch] truncate text-[clamp(0.7rem,1.4vw,0.9rem)] text-crema/45">
                              {v.entreguePor ? (nomesEntregadores.get(v.entreguePor) ?? "sem rotista") : "sem rotista"}
                            </span>
                          </span>
                        </motion.li>
                      ))}
                    </motion.ul>
                  )}
                </div>
              </section>
            </div>
          </>
        )}

        {/* ------------------------------------------------------------ rodapé */}
        {totais && (
          <motion.footer
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SUAVE}
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 border-t border-gold/15 pt-4 text-center"
          >
            <p className="flex items-center gap-2 text-[clamp(0.9rem,2vw,1.35rem)] font-semibold">
              <Wallet size={18} className="text-gold" />
              Faturamento do dia:{" "}
              <span className="num font-display text-[clamp(1.1rem,2.6vw,1.8rem)] font-bold text-gold">
                {moeda(totais.receitaBruta)}
              </span>
            </p>
            <p className="num text-[clamp(0.9rem,2vw,1.35rem)] font-semibold text-gold">
              A receber (PG): {moeda(totais.aReceber)}
            </p>
          </motion.footer>
        )}
      </div>
    </div>
  );
}
