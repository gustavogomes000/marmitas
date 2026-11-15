import { useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChefHat,
  ChevronRight,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { repo } from "@/data";
import { calcularTotais } from "@/domain/totais";
import type { DiaVenda, ResumoDia, Venda } from "@/domain/types";
import { useDias } from "@/shared/hooks/useDados";
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
import { MOLINHO, SUAVE, apertar, itemLista, listaStagger } from "@/shared/lib/motion";
import {
  dataCurta,
  dataLonga,
  deISO,
  diaDaSemana,
  hojeISO,
  moeda,
  normalizar,
  paraISO,
  rotuloRelativo,
} from "@/shared/lib/format";
import { useTitulo } from "@/app/Layout";

type Faixa = 7 | 14 | 30;

const FAIXAS: readonly { dias: Faixa; rotulo: string }[] = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 14, rotulo: "14 dias" },
  { dias: 30, rotulo: "30 dias" },
];

const SEM_DIAS: DiaVenda[] = [];
const SEM_REGISTROS: ResumoDia[] = [];

/** Zona do gráfico: 130px de barra + 18px de sobra para o número em cima. */
const ALTURA_BARRA = 130;
const ALTURA_ZONA = 148;
const MARGEM_TOPO = ALTURA_ZONA - ALTURA_BARRA;
const UM_DIA = 86_400_000;

function soValor(n: number): string {
  return moeda(n).replace(/^R\$\s*/, "");
}

function topClientes(vendas: Venda[], limite: number) {
  const mapa = new Map<string, { chave: string; nome: string; qtd: number }>();
  for (const venda of vendas) {
    if (venda.status === "cancelada") continue;
    const chave = normalizar(venda.cliente);
    if (!chave) continue;
    const atual = mapa.get(chave);
    if (atual) atual.qtd += venda.qtd;
    else mapa.set(chave, { chave, nome: venda.cliente.trim() || chave, qtd: venda.qtd });
  }
  return [...mapa.values()]
    .sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, limite);
}

export function TelaVendas() {
  useTitulo("Vendas por dia");
  const ir = useNavigate();
  const [faixa, setFaixa] = useState<Faixa>(7);
  const [detalhe, setDetalhe] = useState<ResumoDia | null>(null);

  const hoje = hojeISO();
  const ate = hoje;
  const de = paraISO(new Date(deISO(ate).getTime() - (faixa - 1) * UM_DIA));

  const diasQuery = useDias(de, ate);
  const dias = diasQuery.data ?? SEM_DIAS;

  const registrosQuery = useQuery({
    queryKey: ["resumo-dias", de, ate],
    enabled: dias.length > 0,
    queryFn: () =>
      Promise.all(
        dias.map(async (dia): Promise<ResumoDia> => {
          const { vendas } = await repo.vendasDoDia(dia.data);
          return { dia, vendas, totais: calcularTotais(vendas, dia.precoMarmita) };
        }),
      ),
  });

  const registros = registrosQuery.data ?? SEM_REGISTROS;
  const carregando = diasQuery.isPending || (dias.length > 0 && registrosQuery.isPending);

  const painel = useMemo(() => {
    let marmitas = 0;
    let receita = 0;
    let maximo = 0;
    let melhor: ResumoDia | null = null;
    let pior: ResumoDia | null = null;
    for (const r of registros) {
      marmitas += r.totais.marmitas;
      receita += r.totais.receitaBruta;
      maximo = Math.max(maximo, r.totais.marmitas);
      if (!melhor || r.totais.marmitas > melhor.totais.marmitas) melhor = r;
      if (!pior || r.totais.marmitas < pior.totais.marmitas) pior = r;
    }
    return {
      marmitas,
      receita,
      maximo,
      melhor,
      pior,
      media: registros.length > 0 ? marmitas / registros.length : 0,
    };
  }, [registros]);

  const rolando = registros.length > 10;
  const mostrarNumeros = registros.length <= 14;
  const alturaMedia = painel.maximo > 0 ? Math.min(ALTURA_BARRA, (painel.media / painel.maximo) * ALTURA_BARRA) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 px-1">
        <h1 className="font-display text-[22px] font-semibold leading-tight text-brand">Vendas por dia</h1>
        <p className="truncate text-[11px] text-tinta-3">
          {dataCurta(de)} a {dataCurta(ate)} · {registros.length} {registros.length === 1 ? "dia" : "dias"} com venda
        </p>
        <div className="grid grid-cols-3 rounded-full border border-line bg-white p-1 shadow-suave">
          {FAIXAS.map((f) => {
            const ativo = f.dias === faixa;
            return (
              <button
                key={f.dias}
                type="button"
                onClick={() => setFaixa(f.dias)}
                aria-pressed={ativo}
                className="relative isolate min-w-0 rounded-full px-2 py-2"
              >
                {ativo && (
                  <motion.span
                    layoutId="piloto-faixa-vendas"
                    transition={MOLINHO}
                    className="absolute inset-0 rounded-full bg-brand"
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 block text-[12px] font-bold whitespace-nowrap",
                    ativo ? "text-crema" : "text-tinta-2",
                  )}
                >
                  {f.rotulo}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {diasQuery.isError || registrosQuery.isError ? (
        <Cartao className="flex flex-col items-start gap-2.5 border-gold-300 bg-gold-soft p-4">
          <p className="text-[13px] font-semibold leading-snug text-preparada-ink">
            Não consegui abrir as vendas do período. Verifique a internet e tente de novo.
          </p>
          <Botao
            variante="dourado"
            tamanho="sm"
            carregando={diasQuery.isFetching || registrosQuery.isFetching}
            onClick={() => {
              void diasQuery.refetch();
              void registrosQuery.refetch();
            }}
          >
            <RotateCcw size={15} />
            Tentar de novo
          </Botao>
        </Cartao>
      ) : carregando ? (
        <div className="flex flex-col gap-3">
          <Esqueleto className="h-[86px]" />
          <Esqueleto className="h-[240px]" />
          <Esqueleto className="h-[130px]" />
        </div>
      ) : registros.length === 0 ? (
        <Cartao>
          <Vazio
            icone={<CalendarDays size={26} />}
            titulo="Nenhuma venda no período"
            descricao={`Entre ${dataCurta(de)} e ${dataCurta(ate)} não lançamos marmita nenhuma. Assim que o dia for preenchido, o histórico aparece aqui.`}
            acao={
              <Botao variante="dourado" tamanho="sm" onClick={() => ir("/dia")}>
                Lançar vendas do dia
              </Botao>
            }
          />
        </Cartao>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-2">
            <CartaoResumo rotulo="Vendidas" sub="no período" icone={ChefHat}>
              <NumeroAnimado
                valor={painel.marmitas}
                className="block text-[length:clamp(20px,6.4vw,28px)] font-bold text-brand"
              />
            </CartaoResumo>
            <CartaoResumo rotulo="Receita" sub="bruta do período" icone={Wallet}>
              <span className="block truncate text-[length:clamp(13px,4.2vw,18px)] font-bold text-entregue">
                <span className="mr-0.5 text-[10px] font-semibold text-tinta-3">R$</span>
                <NumeroAnimado valor={painel.receita} formatar={soValor} />
              </span>
            </CartaoResumo>
            <CartaoResumo rotulo="Média" sub="marmitas por dia" icone={TrendingUp}>
              <NumeroAnimado
                valor={painel.media}
                formatar={(n) => n.toFixed(1)}
                className="block text-[length:clamp(18px,6vw,26px)] font-bold text-preparada"
              />
            </CartaoResumo>
          </section>

          {registros.length >= 2 && painel.melhor && painel.pior && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SUAVE}
              className="flex flex-wrap items-center gap-2 px-1"
            >
              <Chip className="border-entregue/25 bg-entregue/10 text-entregue-ink">
                <Trophy size={11} />
                Melhor · {dataCurta(painel.melhor.dia.data)}
                <span className="num font-bold">{painel.melhor.totais.marmitas}</span>
              </Chip>
              <Chip className="border-cancelada/25 bg-cancelada/8 text-cancelada-ink">
                <TrendingDown size={11} />
                Pior · {dataCurta(painel.pior.dia.data)}
                <span className="num font-bold">{painel.pior.totais.marmitas}</span>
              </Chip>
            </motion.div>
          )}

          <Cartao className="p-3">
            <TituloSecao className="mb-2">Marmitas por dia</TituloSecao>

            <div className="relative">
              <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: ALTURA_ZONA }}>
                {painel.media > 0 && (
                  <>
                    <div
                      className="absolute inset-x-0 border-t border-dashed border-brand/25"
                      style={{ bottom: MARGEM_TOPO + alturaMedia }}
                    />
                    <span
                      className="num absolute right-0 text-[10px] font-bold text-brand/55"
                      style={{ bottom: MARGEM_TOPO + alturaMedia + 4 }}
                    >
                      média {painel.media.toFixed(1)}
                    </span>
                  </>
                )}
              </div>

              <div className={cn(rolando && "overflow-x-auto snap-x snap-mandatory pb-1")}>
                <div className={cn("flex items-end gap-1.5", rolando ? "w-max" : "w-full")}>
                  {registros.map((r, i) => {
                    const maisAlta = r.totais.marmitas === painel.maximo && painel.maximo > 0;
                    const he = r.dia.data === hoje;
                    const altura =
                      r.totais.marmitas === 0 ? 3 : Math.max(6, (r.totais.marmitas / (painel.maximo || 1)) * ALTURA_BARRA);
                    return (
                      <motion.button
                        key={r.dia.id}
                        type="button"
                        onClick={() => setDetalhe(r)}
                        whileTap={apertar}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ ...SUAVE, delay: 0.04 + i * 0.02 }}
                        aria-label={`Abrir ${dataLonga(r.dia.data)} — ${r.totais.marmitas} marmitas`}
                        className={cn(
                          "flex flex-col items-center gap-1.5 snap-center",
                          rolando ? "w-[38px] shrink-0" : "min-w-0 flex-1",
                        )}
                      >
                        <span className="relative w-full" style={{ height: ALTURA_ZONA }}>
                          <span className="absolute inset-x-0 flex items-end justify-center" style={{ top: MARGEM_TOPO, bottom: 0 }}>
                            <motion.span
                              className={cn(
                                "w-full max-w-[26px] rounded-t-[7px]",
                                r.totais.marmitas === 0
                                  ? "bg-neutro"
                                  : maisAlta
                                    ? "bg-gradient-to-b from-brand-500 to-brand"
                                    : "bg-gradient-to-b from-gold-300 to-gold",
                                he && "shadow-[0_0_0_3px_rgb(251_160_17/0.4)]",
                              )}
                              initial={{ height: 0 }}
                              animate={{ height: altura }}
                              transition={{ ...MOLINHO, delay: 0.08 + i * 0.035 }}
                            />
                          </span>
                          {(mostrarNumeros || maisAlta || he) && r.totais.marmitas > 0 && (
                            <span
                              className={cn(
                                "num absolute left-1/2 -translate-x-1/2 text-[10px] font-bold leading-none",
                                maisAlta ? "text-brand" : "text-tinta-2",
                              )}
                              style={{ bottom: altura + 5 }}
                            >
                              {r.totais.marmitas}
                            </span>
                          )}
                        </span>

                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase leading-none",
                            he ? "text-brand" : "text-tinta-3",
                          )}
                        >
                          {diaDaSemana(r.dia.data).slice(0, 3)}
                        </span>
                        <span className="num text-[9px] leading-none text-tinta-3">{dataCurta(r.dia.data)}</span>
                        <span className={cn("size-1.5 rounded-full", he ? "bg-brand" : "bg-transparent")} />
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>

            <p className="mt-2 px-1 text-[11px] text-tinta-3">
              Toque em uma barra{rolando ? " ou arraste para o lado" : ""} para ver o dia inteiro.
            </p>
          </Cartao>

          <section className="flex flex-col gap-2">
            <TituloSecao acao={<span className="num text-[11px] font-semibold text-tinta-3">{registros.length} dias</span>}>
              Histórico
            </TituloSecao>
            <motion.div variants={listaStagger} initial="oculto" animate="visivel" className="flex flex-col gap-2">
              {[...registros].reverse().map((r) => (
                <LinhaDia key={r.dia.id} registro={r} he={r.dia.data === hoje} aoAbrir={() => setDetalhe(r)} />
              ))}
            </motion.div>
          </section>
        </>
      )}

      <Sheet
        aberto={detalhe !== null}
        aoFechar={() => setDetalhe(null)}
        titulo={detalhe ? dataLonga(detalhe.dia.data) : "Detalhe do dia"}
      >
        {detalhe && <PainelDia registro={detalhe} />}
      </Sheet>
    </div>
  );
}

function CartaoResumo({
  rotulo,
  sub,
  icone: Icone,
  children,
}: {
  rotulo: string;
  sub: string;
  icone: typeof ChefHat;
  children: ReactNode;
}) {
  return (
    <Cartao className="flex min-w-0 flex-col gap-1 p-2.5">
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-tinta-3">
        <Icone size={12} className="shrink-0 text-gold-600" />
        <span className="truncate">{rotulo}</span>
      </span>
      <span className="min-w-0 leading-none">{children}</span>
      <span className="truncate text-[10px] text-tinta-3">{sub}</span>
    </Cartao>
  );
}

function LinhaDia({
  registro,
  he,
  aoAbrir,
}: {
  registro: ResumoDia;
  he: boolean;
  aoAbrir: () => void;
}) {
  const t = registro.totais;
  const aEntregar = Math.max(0, t.marmitas - t.entregues);
  return (
    <motion.button
      type="button"
      variants={itemLista}
      whileTap={apertar}
      onClick={aoAbrir}
      className={cn(
        "w-full rounded-2xl border bg-white p-3 text-left shadow-suave",
        he ? "border-gold/70" : "border-line",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("min-w-0 flex-1 truncate text-[14px] font-semibold", he ? "text-brand" : "text-tinta")}>
          {rotuloRelativo(registro.dia.data)}
        </span>
        <Chip
          className={cn(
            "shrink-0 border-transparent px-2 py-0.5",
            t.marmitas === 0 ? "bg-crema-2 text-tinta-3" : "bg-brand-soft text-brand",
          )}
        >
          <span className="num">{t.marmitas}</span>
        </Chip>
        <span className="num shrink-0 text-right text-[14px] font-bold text-entregue">
          <span className="mr-0.5 text-[9px] font-semibold text-tinta-3">R$</span>
          {soValor(t.receitaBruta)}
        </span>
        <ChevronRight size={16} className="shrink-0 text-tinta-3" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <Barra
            altura="h-1.5"
            partes={[
              { valor: t.entregues, cor: "bg-entregue", chave: "entregue" },
              { valor: aEntregar, cor: "bg-neutro", chave: "restante" },
            ]}
          />
        </span>
        <span className="num shrink-0 text-[10px] font-semibold text-tinta-3">
          {t.entregues}/{t.marmitas} entregues
        </span>
      </div>
    </motion.button>
  );
}

function PainelDia({ registro }: { registro: ResumoDia }) {
  const t = registro.totais;
  const clientes = topClientes(registro.vendas, 5);
  const aEntregar = Math.max(0, t.marmitas - t.entregues);

  return (
    <div className="flex flex-col gap-3 pb-2">
      <div className="grid grid-cols-2 gap-2">
        <MiniBloco rotulo="Marmitas" valor={String(t.marmitas)} cor="text-brand" />
        <MiniBloco rotulo="Receita bruta" valor={moeda(t.receitaBruta)} cor="text-entregue" />
        <MiniBloco rotulo="A receber" valor={moeda(t.aReceber)} cor="text-preparada" />
        <MiniBloco
          rotulo="Preço marmita"
          valor={registro.dia.precoMarmita > 0 ? moeda(registro.dia.precoMarmita) : "sem preço"}
        />
      </div>

      <div className="rounded-2xl border border-line bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2 text-[12px] font-semibold text-tinta">
          <span className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full bg-entregue" />
            Entregues
            <span className="num text-tinta-2">{t.entregues}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full bg-preparada" />
            Pendentes
            <span className="num text-tinta-2">{aEntregar}</span>
          </span>
        </div>
        <Barra
          altura="h-2"
          partes={[
            { valor: t.entregues, cor: "bg-entregue", chave: "entregue" },
            { valor: t.preparadas, cor: "bg-preparada", chave: "preparada" },
            { valor: t.pendentes, cor: "bg-neutro", chave: "pendente" },
          ]}
        />
        {t.canceladas > 0 && (
          <p className="num mt-2 text-[11px] font-semibold text-cancelada">{t.canceladas} canceladas</p>
        )}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 px-1 font-display text-[15px] font-semibold text-brand">
          <Users size={15} />
          Mais marmitas do dia
        </p>
        {clientes.length === 0 ? (
          <p className="px-1 text-[13px] text-tinta-3">Nenhum cliente lançado nesse dia.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {clientes.map((c, i) => (
              <motion.li
                key={c.chave}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...MOLINHO, delay: i * 0.04 }}
                className="flex items-center gap-2.5 rounded-xl bg-crema-2/70 py-2 pr-3 pl-2"
              >
                <span
                  className={cn(
                    "num grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                    i === 0 ? "bg-gold text-brand-ink" : "border border-line bg-white text-tinta-2",
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-tinta">{c.nome}</span>
                <span className="num shrink-0 text-[13px] font-bold text-brand">×{c.qtd}</span>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MiniBloco({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-3">
      <p className="truncate text-[10px] font-bold uppercase tracking-wide text-tinta-3">{rotulo}</p>
      <p className={cn("num mt-0.5 truncate text-[16px] font-bold", cor ?? "text-tinta")}>{valor}</p>
    </div>
  );
}
