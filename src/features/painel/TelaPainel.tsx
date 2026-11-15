import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Check, ChevronRight, Receipt, RotateCw, TriangleAlert, Utensils } from "lucide-react";
import { toast } from "sonner";
import { nomeParaExibir } from "@/domain/parser";
import { faltaReceber, idMovimentacaoPagamento } from "@/domain/totais";
import type { Movimentacao, ResumoDia, VendaEmAberto } from "@/domain/types";
import { useTitulo } from "@/app/Layout";
import {
  useCategorias,
  useMovimentacaoRapida,
  useMovimentacoes,
  useResumosPeriodo,
  useSalvarVendas,
  useVendasEmAberto,
} from "@/shared/hooks/useDados";
import { useReduzirMovimento, vibrar } from "@/shared/hooks/useAnimacao";
import {
  Barra,
  Botao,
  Cartao,
  Chip,
  Esqueleto,
  NumeroAnimado,
  Sheet,
  TituloSecao,
  Vazio,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/cn";
import {
  dataCurta,
  dataLonga,
  deISO,
  diaDaSemana,
  hojeISO,
  moeda,
  paraISO,
  paraNumero,
  rotuloRelativo,
} from "@/shared/lib/format";
import { MOLINHO, SUAVE, apertar, itemLista, listaStagger, subir } from "@/shared/lib/motion";
import { APARENCIA, ENTREGUE, PAGA, PREPARADA } from "@/shared/lib/status";

type Periodo = "sete" | "trinta" | "noventa" | "tudo";

interface LinhaDinheiro {
  data: string;
  entradas: number;
  saidas: number;
}

interface GrupoCobranca {
  data: string;
  itens: VendaEmAberto[];
  soma: number;
}

const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "sete", rotulo: "7 dias" },
  { id: "trinta", rotulo: "30 dias" },
  { id: "noventa", rotulo: "90 dias" },
  { id: "tudo", rotulo: "Tudo" },
];

const DIAS_MS = 86_400_000;
const TUDO_DE = "1970-01-01";
const TUDO_ATE = "2999-12-31";
const SEM_MOV: Movimentacao[] = [];
const SEM_RESUMOS: ResumoDia[] = [];

function intervalo(periodo: Periodo, hoje: string): { de: string; ate: string } {
  if (periodo === "tudo") return { de: TUDO_DE, ate: TUDO_ATE };
  const recuo = periodo === "sete" ? 6 : periodo === "trinta" ? 29 : 89;
  return { de: paraISO(new Date(deISO(hoje).getTime() - recuo * DIAS_MS)), ate: hoje };
}

function soValor(n: number): string {
  return moeda(n).replace(/^R\$\s*/, "");
}

function rotuloDias(dias: number): string {
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}

/** O título do dia é a anotação livre dele; sem anotação, a data por extenso. */
function tituloDoDia(r: ResumoDia): string {
  return r.dia.obs.trim() || dataLonga(r.dia.data);
}

/** O que falta receber de uma cobrança: preço próprio e pagamento parcial contam. */
function valorCobranca(item: VendaEmAberto): number {
  return faltaReceber(item.venda, item.dia.precoMarmita);
}

export function TelaPainel() {
  useTitulo("Painel");
  const ir = useNavigate();
  const reduzido = useReduzirMovimento();
  const hoje = useMemo(() => hojeISO(), []);
  const [periodo, setPeriodo] = useState<Periodo>("sete");
  const [diaDetalhe, setDiaDetalhe] = useState<ResumoDia | null>(null);
  const [cobrando, setCobrando] = useState<VendaEmAberto | null>(null);

  const { de, ate } = useMemo(() => intervalo(periodo, hoje), [periodo, hoje]);

  const historiaQuery = useMovimentacoes(TUDO_DE, TUDO_ATE);
  const periodoMovQuery = useMovimentacoes(de, ate);
  const resumosQuery = useResumosPeriodo(de, ate);
  const abertasQuery = useVendasEmAberto(hoje);
  const categoriasQuery = useCategorias();

  const historia = useMemo(() => historiaQuery.data ?? SEM_MOV, [historiaQuery.data]);
  const movPeriodo = useMemo(() => periodoMovQuery.data ?? SEM_MOV, [periodoMovQuery.data]);
  const resumos = useMemo(() => resumosQuery.data ?? SEM_RESUMOS, [resumosQuery.data]);

  const caixaHistoria = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    for (const m of historia) {
      if (m.fluxo === "entrada") entradas += m.valor;
      else saidas += m.valor;
    }
    return { entradas, saidas, saldo: entradas - saidas };
  }, [historia]);

  const medida = useMemo(() => {
    let marmitas = 0;
    let receitaBruta = 0;
    let recebido = 0;
    let gasto = 0;
    let melhor: ResumoDia | null = null;
    for (const r of resumos) {
      marmitas += r.totais.marmitas;
      receitaBruta += r.totais.receitaBruta;
      recebido += r.totais.recebido;
      if (!melhor || r.totais.marmitas > melhor.totais.marmitas) melhor = r;
    }
    for (const m of movPeriodo) if (m.fluxo === "saida") gasto += m.valor;
    return {
      marmitas,
      media: resumos.length > 0 ? marmitas / resumos.length : 0,
      melhor,
      ticket: marmitas > 0 ? receitaBruta / marmitas : 0,
      recebido,
      gasto,
      resultado: recebido - gasto,
    };
  }, [resumos, movPeriodo]);

  const linhasDinheiro = useMemo(() => {
    const mapa = new Map<string, LinhaDinheiro>();
    for (const m of movPeriodo) {
      const linha = mapa.get(m.data) ?? { data: m.data, entradas: 0, saidas: 0 };
      if (m.fluxo === "entrada") linha.entradas += m.valor;
      else linha.saidas += m.valor;
      mapa.set(m.data, linha);
    }
    const linhas = [...mapa.values()].sort((a, b) => (a.data < b.data ? 1 : -1));
    const maximo = linhas.reduce((t, l) => Math.max(t, l.entradas, l.saidas), 0);
    return { linhas, maximo };
  }, [movPeriodo]);

  const maxMarmitas = useMemo(
    () => resumos.reduce((t, r) => Math.max(t, r.totais.marmitas), 0),
    [resumos],
  );

  const diasAbertos = useMemo(
    () => resumos.filter((r) => r.totais.aReceber > 0 || r.totais.pendentes > 0 || !r.dia.fechadoEm),
    [resumos],
  );

  const gruposCobranca = useMemo(() => {
    const mapa = new Map<string, GrupoCobranca>();
    for (const item of abertasQuery.data ?? []) {
      const grupo = mapa.get(item.dia.data);
      if (grupo) {
        grupo.itens.push(item);
        grupo.soma += valorCobranca(item);
      } else {
        mapa.set(item.dia.data, { data: item.dia.data, itens: [item], soma: valorCobranca(item) });
      }
    }
    return [...mapa.values()].sort((a, b) => (a.data < b.data ? 1 : -1));
  }, [abertasQuery.data]);

  const totalCobranca = gruposCobranca.reduce((s, g) => s + g.soma, 0);

  const categoriaEntradaId = useMemo(
    () => (categoriasQuery.data ?? []).find((c) => c.fluxo === "entrada")?.id ?? "cat_venda",
    [categoriasQuery.data],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
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
                    layoutId="piloto-painel-periodo"
                    transition={MOLINHO}
                    className="absolute inset-0 rounded-full bg-brand"
                  />
                )}
                <span className="relative">{p.rotulo}</span>
              </Botao>
            );
          })}
        </div>
        <p className="px-1 text-[11.5px] text-tinta-3">O período muda só as métricas e os gráficos.</p>
      </div>

      {historiaQuery.isError ? (
        <ErroPainel rotulo="o saldo de toda a história" aoTentar={() => historiaQuery.refetch()} />
      ) : (
        <motion.section
          variants={subir}
          initial="oculto"
          animate="visivel"
          className="rounded-[22px] bg-gradient-to-br from-brand via-brand-600 to-gold p-5 text-crema shadow-elevado"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-crema/75">Dinheiro no caixa</p>
          {historiaQuery.isLoading ? (
            <div className="mt-2 h-12 w-56 max-w-full rounded-2xl bg-crema/15" />
          ) : (
            <motion.h1
              initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ ...MOLINHO, delay: 0.08 }}
              className="mt-1.5 min-w-0 font-display text-[clamp(2rem,11vw,2.9rem)] font-semibold leading-none"
            >
              <NumeroAnimado valor={caixaHistoria.saldo} formatar={moeda} className="text-crema" />
            </motion.h1>
          )}
          <p className="mt-2 text-[11.5px] leading-snug text-crema/75">
            É tudo que já entrou e saiu, do começo até hoje. Esse número não muda com o período.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MarcadorHistoria rotulo="Entrou" valor={caixaHistoria.entradas} ponto="bg-entregue" reduzido={reduzido} />
            <MarcadorHistoria rotulo="Saiu" valor={caixaHistoria.saidas} ponto="bg-saida" reduzido={reduzido} />
          </div>
        </motion.section>
      )}

      {resumosQuery.isError ? (
        <ErroPainel rotulo="as vendas do período" aoTentar={() => resumosQuery.refetch()} />
      ) : resumosQuery.isPending ? (
        <div className="flex flex-col gap-2.5">
          <Esqueleto className="h-[172px]" />
          <Esqueleto className="h-[204px]" />
          <Esqueleto className="h-[140px]" />
        </div>
      ) : resumos.length === 0 ? (
        <Cartao className="p-2">
          <Vazio
            icone={<Utensils size={26} />}
            titulo="Período sem marmitas"
            descricao="Nenhum dia lançado neste período. Troque os dias acima ou lance pedidos novos."
            acao={
              <Botao variante="dourado" tamanho="sm" onClick={() => ir("/dia")}>
                <CalendarDays size={15} />
                Lançar no dia
              </Botao>
            }
          />
        </Cartao>
      ) : (
        <>
          <motion.section
            key={`medidas-${de}-${ate}`}
            variants={subir}
            initial="oculto"
            animate="visivel"
            className="grid grid-cols-2 gap-2.5"
          >
            <Metrica valor={medida.marmitas} rotulo="Marmitas vendidas" cor="text-brand" />
            <Metrica valor={medida.media} rotulo="Média por dia" cor="text-brand" />
            <Metrica
              valor={medida.melhor?.totais.marmitas ?? 0}
              rotulo="Melhor dia"
              cor="text-gold-600"
              sub={
                medida.melhor
                  ? medida.melhor.dia.obs.trim() ||
                    `${diaDaSemana(medida.melhor.dia.data)}, ${dataCurta(medida.melhor.dia.data)}`
                  : undefined
              }
            />
            <Metrica valor={medida.ticket} rotulo="Ticket médio" cor="text-entregue" dinheiro />
            <Metrica valor={medida.recebido} rotulo="Recebido" cor="text-paga-ink" dinheiro />
            <Metrica valor={medida.gasto} rotulo="Gasto" cor="text-saida" dinheiro />
            <Metrica
              valor={medida.resultado}
              rotulo="Resultado"
              sub={medida.resultado >= 0 ? "recebido cobriu os gastos" : "recebido não cobriu os gastos"}
              cor={medida.resultado >= 0 ? "text-entregue" : "text-preparada-ink"}
              dinheiro
              className="col-span-2"
            />
          </motion.section>

          <motion.section
            key={`grafico-${de}-${ate}`}
            variants={subir}
            initial="oculto"
            animate="visivel"
            className="flex flex-col gap-2"
          >
            <TituloSecao
              acao={<span className="num whitespace-nowrap text-[11px] font-semibold text-tinta-3">{resumos.length} dias</span>}
            >
              Marmitas por dia
            </TituloSecao>
            <Cartao className="p-4">
              <div className="flex snap-x items-start gap-2 overflow-x-auto overscroll-x-contain pb-1">
                {resumos.map((r, i) => (
                  <BarraDoDia
                    key={r.dia.id}
                    registro={r}
                    maximo={maxMarmitas}
                    he={r.dia.data === hoje}
                    atraso={i * 0.035}
                    reduzido={reduzido}
                    aoAbrir={() => setDiaDetalhe(r)}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-tinta-3">Toque em uma barra para ver o dia por dentro.</p>
            </Cartao>
          </motion.section>

          {periodoMovQuery.isError ? (
            <ErroPainel rotulo="os gastos do período" aoTentar={() => periodoMovQuery.refetch()} />
          ) : periodoMovQuery.isPending ? (
            <Esqueleto className="h-[120px]" />
          ) : (
            <motion.section
              key={`dinheiro-${de}-${ate}`}
              variants={subir}
              initial="oculto"
              animate="visivel"
              className="flex flex-col gap-2"
            >
              <TituloSecao
                acao={
                  <span className="num whitespace-nowrap text-[11px] font-semibold text-tinta-3">
                    {linhasDinheiro.linhas.length} dias
                  </span>
                }
              >
                Receita × Despesa
              </TituloSecao>
              {linhasDinheiro.linhas.length === 0 ? (
                <Cartao className="px-4 py-3">
                  <p className="truncate text-[12.5px] text-tinta-2">
                    Nenhum lançamento de caixa no período — só vendas de marmita.
                  </p>
                </Cartao>
              ) : (
                <Cartao className="flex flex-col gap-0.5 p-3">
                  {linhasDinheiro.linhas.map((l, i) => (
                    <LinhaDinheiro
                      key={l.data}
                      linha={l}
                      maximo={linhasDinheiro.maximo}
                      atraso={i * 0.04}
                      reduzido={reduzido}
                    />
                  ))}
                </Cartao>
              )}
            </motion.section>
          )}
        </>
      )}

      {!resumosQuery.isPending && !resumosQuery.isError && (
        <motion.section variants={subir} initial="oculto" animate="visivel" className="flex flex-col gap-2">
          <TituloSecao
            acao={
              <span className="num whitespace-nowrap text-[11px] font-semibold text-tinta-3">{diasAbertos.length}</span>
            }
          >
            Dias em aberto
          </TituloSecao>
          {diasAbertos.length === 0 ? (
            <Cartao className="flex items-center gap-2.5 border-entregue/40 bg-entregue/8 px-4 py-3">
              <Check size={16} className="shrink-0 text-entregue" />
              <p className="min-w-0 truncate text-[12.5px] font-semibold text-entregue-ink">
                Todos os dias do período estão fechados e recebidos.
              </p>
            </Cartao>
          ) : (
            <motion.div variants={listaStagger} initial={reduzido ? "visivel" : "oculto"} animate="visivel" className="flex flex-col gap-2">
              {diasAbertos.map((r) => (
                <LinhaDiaAberto key={r.dia.id} registro={r} aoAbrir={() => ir(`/dia?data=${r.dia.data}`)} />
              ))}
            </motion.div>
          )}
        </motion.section>
      )}

      <motion.section variants={subir} initial="oculto" animate="visivel" className="flex flex-col gap-2">
        <TituloSecao
          acao={
            totalCobranca > 0 ? (
              <span className="num whitespace-nowrap text-[11px] font-bold text-preparada-ink">{moeda(totalCobranca)}</span>
            ) : undefined
          }
        >
          Cobranças pendentes
        </TituloSecao>
        {abertasQuery.isError ? (
          <ErroPainel rotulo="as cobranças" aoTentar={() => abertasQuery.refetch()} />
        ) : abertasQuery.isPending ? (
          <div className="flex flex-col gap-2">
            <Esqueleto className="h-14" />
            <Esqueleto className="h-14" />
          </div>
        ) : gruposCobranca.length === 0 ? (
          <Cartao className="flex items-center gap-2.5 border-entregue/40 bg-entregue/8 px-4 py-3">
            <Check size={16} className="shrink-0 text-entregue" />
            <p className="min-w-0 truncate text-[12.5px] font-semibold text-entregue-ink">
              Nenhuma marmita fiada — tudo que foi PG já virou dinheiro.
            </p>
          </Cartao>
        ) : (
          gruposCobranca.map((g) => (
            <div key={g.data} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2 px-1">
                <h3 className="min-w-0 truncate text-[12px] font-semibold text-tinta-2">{rotuloRelativo(g.data)}</h3>
                <span className="num shrink-0 whitespace-nowrap text-[11.5px] font-bold text-preparada-ink">
                  {soValor(g.soma)}
                </span>
              </div>
              <motion.div
                variants={listaStagger}
                initial={reduzido ? "visivel" : "oculto"}
                animate="visivel"
                className="flex flex-col gap-2"
              >
                <AnimatePresence initial={false}>
                  {g.itens.map((item) => (
                    <LinhaCobranca key={item.venda.id} item={item} aoReceber={() => setCobrando(item)} />
                  ))}
                </AnimatePresence>
              </motion.div>
            </div>
          ))
        )}
      </motion.section>

      <Sheet
        aberto={diaDetalhe !== null}
        aoFechar={() => setDiaDetalhe(null)}
        titulo="O dia por dentro"
        rodape={
          diaDetalhe ? (
            <Botao
              variante="primario"
              tamanho="lg"
              larguraTotal
              onClick={() => {
                const iso = diaDetalhe.dia.data;
                setDiaDetalhe(null);
                ir(`/dia?data=${iso}`);
              }}
            >
              <CalendarDays size={17} />
              Abrir o dia
            </Botao>
          ) : undefined
        }
      >
        {diaDetalhe && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={diaDetalhe.dia.id}
              initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SUAVE}
            >
              <DetalheDoDia registro={diaDetalhe} reduzido={reduzido} />
            </motion.div>
          </AnimatePresence>
        )}
      </Sheet>

      {cobrando && (
        <PainelRecebimento
          key={cobrando.venda.id}
          item={cobrando}
          hoje={hoje}
          categoriaId={categoriaEntradaId}
          aoFechar={() => setCobrando(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- erro */

function ErroPainel({ rotulo, aoTentar }: { rotulo: string; aoTentar: () => void }) {
  return (
    <Cartao className="flex items-center gap-3 border-gold/50 bg-gold-soft p-3.5">
      <TriangleAlert size={17} className="shrink-0 text-preparada-ink" />
      <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-preparada-ink">
        Não deu para carregar {rotulo}.
      </p>
      <Botao variante="neutro" tamanho="sm" onClick={aoTentar} className="shrink-0 gap-1.5">
        <RotateCw size={13} />
        Tentar de novo
      </Botao>
    </Cartao>
  );
}

/* ------------------------------------------------------------------- hero */

function MarcadorHistoria({
  rotulo,
  valor,
  ponto,
  reduzido,
}: {
  rotulo: string;
  valor: number;
  ponto: string;
  reduzido: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-2xl bg-crema/12 px-3 py-2.5">
      <motion.span
        initial={reduzido ? false : { scale: 0, opacity: 0 }}
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

/* ---------------------------------------------------------------- métricas */

function Metrica({
  valor,
  rotulo,
  cor,
  dinheiro,
  sub,
  className,
}: {
  valor: number;
  rotulo: string;
  cor: string;
  dinheiro?: boolean;
  sub?: string;
  className?: string;
}) {
  return (
    <Cartao className={cn("flex min-w-0 flex-col gap-1 p-3.5", className)}>
      <NumeroAnimado
        valor={valor}
        formatar={dinheiro ? moeda : undefined}
        className={cn(
          "whitespace-nowrap font-display font-bold leading-none",
          dinheiro ? "text-[length:clamp(13px,4.4vw,16px)]" : "text-[length:clamp(17px,5.4vw,21px)]",
          cor,
        )}
      />
      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-tinta-3">{rotulo}</span>
      {sub && <span className="truncate text-[10px] font-semibold text-tinta-2">{sub}</span>}
    </Cartao>
  );
}

/* ----------------------------------------------------------------- gráfico */

function BarraDoDia({
  registro,
  maximo,
  he,
  atraso,
  reduzido,
  aoAbrir,
}: {
  registro: ResumoDia;
  maximo: number;
  he: boolean;
  atraso: number;
  reduzido: boolean;
  aoAbrir: () => void;
}) {
  const t = registro.totais;
  const parcela = maximo > 0 ? Math.max(0.06, t.marmitas / maximo) : 0.06;
  return (
    <motion.button
      type="button"
      onClick={aoAbrir}
      whileTap={reduzido ? undefined : apertar}
      className="flex w-11 shrink-0 snap-center cursor-pointer flex-col items-center justify-end gap-1.5"
      title={`${dataCurta(registro.dia.data)} — ${t.marmitas} marmitas · ${moeda(t.receitaBruta)}`}
    >
      <span className="num text-[11px] font-bold leading-none text-brand">{t.marmitas}</span>
      <span className="flex h-28 w-full items-end">
        <motion.span
          initial={reduzido ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ ...MOLINHO, delay: atraso }}
          style={{ height: `${Math.round(parcela * 100)}%`, transformOrigin: "bottom" }}
          className={cn(
            "w-full rounded-lg bg-gradient-to-t from-brand to-brand-500",
            he && "from-gold-600 to-gold shadow-suave",
          )}
        />
      </span>
      <span className="num whitespace-nowrap text-[10px] leading-none text-tinta-3">{dataCurta(registro.dia.data)}</span>
    </motion.button>
  );
}

function DetalheDoDia({ registro, reduzido }: { registro: ResumoDia; reduzido: boolean }) {
  const t = registro.totais;
  return (
    <div className="flex flex-col gap-3 pb-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="min-w-0 truncate font-display text-[16px] font-semibold text-brand">{tituloDoDia(registro)}</p>
        <Chip className="num shrink-0 whitespace-nowrap border-gold-300 bg-gold-soft text-preparada-ink">
          {registro.dia.precoMarmita > 0 ? `marmita ${moeda(registro.dia.precoMarmita)}` : "sem preço"}
        </Chip>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MedidaPainel valor={t.marmitas} rotulo="Marmitas" cor="text-brand" />
        <MedidaPainel valor={t.entregues} rotulo="Entregues" cor="text-entregue" />
        <MedidaPainel valor={t.pendentes} rotulo="Pendentes" cor="text-neutro-ink" />
        <MedidaPainel valor={t.aReceber} rotulo="A receber" cor="text-paga-ink" dinheiro />
      </div>

      <div className="rounded-2xl border border-line bg-white p-3">
        <Barra
          altura="h-2.5"
          partes={[
            { valor: t.entregues, cor: ENTREGUE.barra, chave: "entregue" },
            { valor: t.preparadas, cor: PREPARADA.barra, chave: "preparada" },
            { valor: t.pendentes, cor: APARENCIA.pendente.barra, chave: "pendente" },
          ]}
        />
        <p className="num mt-2 text-[11px] font-semibold text-tinta-3">
          {t.entregues}/{t.marmitas} entregues · {t.pagaQtd}/{t.pgQtd} PG pagas
        </p>
      </div>

      <motion.p
        initial={reduzido ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SUAVE, delay: 0.1 }}
        className="num min-w-0 truncate px-1 text-[12.5px] text-tinta-2"
      >
        <span className="font-bold text-entregue">{soValor(t.recebido)}</span> recebido de{" "}
        <span className="font-bold text-brand">{soValor(t.receitaBruta)}</span> no dia
      </motion.p>
    </div>
  );
}

function MedidaPainel({
  valor,
  rotulo,
  cor,
  dinheiro,
}: {
  valor: number;
  rotulo: string;
  cor: string;
  dinheiro?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 rounded-2xl border border-line bg-white px-1 py-2.5">
      <NumeroAnimado
        valor={valor}
        formatar={dinheiro ? moeda : undefined}
        className={cn(
          "whitespace-nowrap font-display font-bold leading-none",
          dinheiro ? "text-[length:clamp(12px,3.8vw,15px)]" : "text-[length:clamp(15px,4.4vw,18px)]",
          cor,
        )}
      />
      <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-wide text-tinta-3">{rotulo}</span>
    </div>
  );
}

/* -------------------------------------------------------- receita × despesa */

function LinhaDinheiro({
  linha,
  maximo,
  atraso,
  reduzido,
}: {
  linha: LinhaDinheiro;
  maximo: number;
  atraso: number;
  reduzido: boolean;
}) {
  const liquido = linha.entradas - linha.saidas;
  return (
    <motion.div
      initial={reduzido ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SUAVE, delay: atraso }}
      className="flex items-center gap-3 py-2"
    >
      <span className="num w-11 shrink-0 whitespace-nowrap text-[11px] font-semibold text-tinta-3">
        {dataCurta(linha.data)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <Trilho valor={linha.entradas} maximo={maximo} cor="bg-entregue" atraso={atraso} reduzido={reduzido} />
        <Trilho valor={linha.saidas} maximo={maximo} cor="bg-saida/60" atraso={atraso + 0.05} reduzido={reduzido} />
      </span>
      <span
        className={cn(
          "num w-20 shrink-0 whitespace-nowrap text-right text-[12px] font-bold",
          liquido > 0 ? "text-entregue" : liquido < 0 ? "text-preparada-ink" : "text-tinta-3",
        )}
      >
        {liquido > 0 ? "+" : liquido < 0 ? "−" : "="}
        {soValor(Math.abs(liquido))}
      </span>
    </motion.div>
  );
}

function Trilho({
  valor,
  maximo,
  cor,
  atraso,
  reduzido,
}: {
  valor: number;
  maximo: number;
  cor: string;
  atraso: number;
  reduzido: boolean;
}) {
  const parcela = maximo > 0 ? (valor / maximo) * 100 : 0;
  return (
    <span className="h-1.5 w-full overflow-hidden rounded-full bg-crema-2">
      <motion.span
        className={cn("block h-full rounded-full", cor)}
        initial={reduzido ? false : { width: 0 }}
        animate={{ width: `${parcela}%` }}
        transition={{ ...SUAVE, delay: atraso }}
      />
    </span>
  );
}

/* ------------------------------------------------------------ dias abertos */

function LinhaDiaAberto({ registro, aoAbrir }: { registro: ResumoDia; aoAbrir: () => void }) {
  const t = registro.totais;
  return (
    <motion.button
      type="button"
      variants={itemLista}
      whileTap={apertar}
      onClick={aoAbrir}
      className="card flex w-full items-center gap-3 p-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-tinta">{tituloDoDia(registro)}</span>
        <span className="num mt-0.5 block truncate text-[11px] text-tinta-3">
          {dataCurta(registro.dia.data)} · marmita {moeda(registro.dia.precoMarmita)}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {t.pendentes > 0 && <Chip className={PREPARADA.chip}>{t.pendentes} pendentes</Chip>}
          {t.aReceber > 0 && <Chip className={PAGA.chip}>{soValor(t.aReceber)} a receber</Chip>}
          {!registro.dia.fechadoEm && (
            <Chip className="border-line bg-crema-2 text-tinta-3">sem fechar</Chip>
          )}
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-tinta-3" />
    </motion.button>
  );
}

/* ---------------------------------------------------------------- cobranças */

function LinhaCobranca({ item, aoReceber }: { item: VendaEmAberto; aoReceber: () => void }) {
  const atrasada = item.diasSemPagar > 7;
  const devido = valorCobranca(item);
  return (
    <motion.div
      layout
      variants={itemLista}
      initial="oculto"
      animate="visivel"
      exit="saindo"
      className={cn(
        "card flex items-center gap-3 overflow-hidden p-3",
        atrasada ? "border-preparada/50 bg-gold-soft" : "bg-white",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-tinta">
          {nomeParaExibir(item.venda.cliente)}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <span className="num min-w-0 truncate text-[11px] text-tinta-3">
            ×{item.venda.qtd} · {soValor(devido)}
          </span>
          <span
            className={cn(
              "num shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold",
              atrasada ? "bg-gold text-brand-ink" : "bg-crema-2 text-tinta-3",
            )}
          >
            {rotuloDias(item.diasSemPagar)}
          </span>
        </span>
      </span>
      <Botao variante="dourado" tamanho="sm" onClick={aoReceber} className="shrink-0 gap-1.5">
        <Receipt size={14} />
        Receber
      </Botao>
    </motion.div>
  );
}

/* -------------------------------------------------------- painel receber */

function PainelRecebimento({
  item,
  hoje,
  categoriaId,
  aoFechar,
}: {
  item: VendaEmAberto;
  hoje: string;
  categoriaId: string;
  aoFechar: () => void;
}) {
  const salvarVendas = useSalvarVendas(item.dia.data);
  const caixa = useMovimentacaoRapida();
  const devido = valorCobranca(item);
  const [valorTexto, setValorTexto] = useState(devido.toFixed(2).replace(".", ","));
  const valor = paraNumero(valorTexto);

  function confirmar() {
    const centavos = Math.round(valor * 100) / 100;
    if (centavos <= 0) {
      vibrar([10, 40, 10]);
      return;
    }
    // valorPago guarda quanto efetivamente entrou — permite cobrança parcial.
    salvarVendas.mutate([{ ...item.venda, paga: true, valorPago: centavos }]);
    caixa.gravar.mutate(
      {
        id: idMovimentacaoPagamento(item.venda.id),
        data: hoje,
        descricao: `Marmitas — ${item.venda.cliente}`,
        valor: centavos,
        fluxo: "entrada",
        categoriaId,
        forma: "pix",
        obs: `cobrança de ${dataCurta(item.dia.data)}`,
        criadoEm: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          vibrar([8, 20, 8]);
          toast.success(`${moeda(centavos)} no caixa`, {
            description: `${nomeParaExibir(item.venda.cliente)} · cobrança de ${dataCurta(item.dia.data)}`,
          });
          aoFechar();
        },
        onError: () => toast.error("Não entrou no caixa. Tente de novo."),
      },
    );
  }

  return (
    <Sheet
      aberto
      aoFechar={aoFechar}
      titulo="Receber cobrança"
      rodape={
        <Botao
          variante="primario"
          tamanho="lg"
          larguraTotal
          disabled={valor <= 0}
          carregando={salvarVendas.isPending || caixa.gravar.isPending}
          onClick={confirmar}
        >
          <Receipt size={17} />
          {valor > 0 ? `Entrar ${moeda(valor)} no caixa` : "Digite o valor"}
        </Botao>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-[13px] leading-snug text-tinta-2">
          <span className="font-bold text-brand">{nomeParaExibir(item.venda.cliente)}</span> · {item.venda.qtd} marmita
          {item.venda.qtd > 1 ? "s" : ""} de {rotuloRelativo(item.dia.data)} —{" "}
          <span className="font-semibold text-preparada-ink">{rotuloDias(item.diasSemPagar)}</span> sem pagar. Ajuste
          o valor se teve frete ou desconto.
        </p>

        <div className="card flex items-center justify-between gap-3 p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-tinta-3">entra no caixa</span>
          <input
            inputMode="decimal"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value.replace(/[^\d,.]/g, ""))}
            aria-label="Valor a receber"
            className="num w-32 whitespace-nowrap bg-transparent text-right text-[26px] font-bold text-paga-ink focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <Botao
            variante="neutro"
            tamanho="sm"
            className="flex-1"
            onClick={() => setValorTexto(devido.toFixed(2).replace(".", ","))}
          >
            {moeda(devido)} exato
          </Botao>
          <Botao
            variante="neutro"
            tamanho="sm"
            className="flex-1"
            onClick={() => setValorTexto((devido + 5).toFixed(2).replace(".", ","))}
          >
            + frete {moeda(5)}
          </Botao>
        </div>
      </div>
    </Sheet>
  );
}
