import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Bike, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Receipt, RotateCcw, Users, Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { repo } from "@/data";
import { calcularTotais, faltaReceber, idMovimentacaoPagamento } from "@/domain/totais";
import { nomeParaExibir } from "@/domain/parser";
import type { DiaVenda, ResumoDia, TotaisDia, Venda } from "@/domain/types";
import {
  useCategorias, useDias, useEntregadores, useMovimentacaoRapida, useSalvarVendas,
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
import { MOLINHO, SUAVE, apertar, itemLista, listaStagger } from "@/shared/lib/motion";
import {
  dataCurta,
  dataLonga,
  deISO,
  diaDaSemana,
  hojeISO,
  moeda,
  normalizar,
} from "@/shared/lib/format";
import { APARENCIA, ENTREGUE, PAGA, PREPARADA } from "@/shared/lib/status";
import { useTitulo } from "@/app/Layout";

const SEM_DIAS: DiaVenda[] = [];
const SEM_REGISTROS: ResumoDia[] = [];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

function pad(n: number): string {
  return `${n}`.padStart(2, "0");
}

function soValor(n: number): string {
  return moeda(n).replace(/^R\$\s*/, "");
}

/** Ponto do calendário: amarelo enquanto falta entregar, azul com fiado, verde dia redondo. */
function pontoDoDia(t: TotaisDia): string | null {
  if (t.marmitas === 0) return null;
  if (t.entregues < t.marmitas) return PREPARADA.ponto;
  if (t.aReceber > 0) return PAGA.ponto;
  return ENTREGUE.ponto;
}

function topClientes(vendas: Venda[], limite: number) {
  const mapa = new Map<string, { chave: string; nome: string; qtd: number }>();
  for (const v of vendas) {
    if (v.status === "cancelada") continue;
    const chave = normalizar(v.cliente);
    if (!chave) continue;
    const atual = mapa.get(chave);
    if (atual) atual.qtd += v.qtd;
    else mapa.set(chave, { chave, nome: v.cliente.trim() || chave, qtd: v.qtd });
  }
  return [...mapa.values()]
    .sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, limite);
}

export function TelaAgenda() {
  useTitulo("Agenda");
  const ir = useNavigate();
  const reduzido = useReduzirMovimento();
  const hoje = hojeISO();

  const [alvo, setAlvo] = useState(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() };
  });
  const [dir, setDir] = useState(1);
  const [aberta, setAberta] = useState<string | null>(null);

  const ultimoDia = new Date(alvo.ano, alvo.mes + 1, 0).getDate();
  const de = `${alvo.ano}-${pad(alvo.mes + 1)}-01`;
  const ate = `${alvo.ano}-${pad(alvo.mes + 1)}-${pad(ultimoDia)}`;

  const diasQuery = useDias(de, ate);
  const dias = diasQuery.data ?? SEM_DIAS;

  const registrosQuery = useQuery({
    queryKey: ["agenda-mes", de, ate],
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

  const entregadoresQuery = useEntregadores();
  const nomeEntregador = (id: string): string =>
    (entregadoresQuery.data ?? []).find((e) => e.id === id)?.nome ?? "removido";

  const porData = useMemo(
    () => new Map(registros.map((r) => [r.dia.data, r] as const)),
    [registros],
  );

  /** A ficha é sempre lida do query cache: ao dar baixa o dinheiro entra e a lista reflete na hora. */
  const detalhe = aberta ? porData.get(aberta) ?? null : null;
  const salvarVendas = useSalvarVendas(detalhe?.dia.data ?? hoje);
  const caixa = useMovimentacaoRapida();
  const categorias = useCategorias();

  function darBaixa(venda: Venda, dia: DiaVenda) {
    const falta = Math.round(faltaReceber(venda, dia.precoMarmita) * 100) / 100;
    if (falta <= 0) return;
    const categoriaVenda = (categorias.data ?? []).find((c) => c.fluxo === "entrada");
    salvarVendas.mutate([{ ...venda, paga: true, valorPago: (venda.valorPago ?? 0) + falta }]);
    caixa.gravar.mutate(
      {
        id: idMovimentacaoPagamento(venda.id),
        data: hoje,
        descricao: `Marmitas — ${venda.cliente}`,
        valor: falta,
        fluxo: "entrada",
        categoriaId: categoriaVenda?.id ?? "cat_venda",
        forma: "pix",
        obs: `baixa da ficha de ${dataCurta(dia.data)}`,
        criadoEm: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          vibrar([8, 20, 8]);
          toast.success(`${moeda(falta)} no caixa`, {
            description: `${nomeParaExibir(venda.cliente)} · dia ${dataCurta(dia.data)}`,
          });
        },
        onError: () => toast.error("Não entrou no caixa. Tente de novo."),
      },
    );
  }

  const decrescentes = useMemo(() => [...registros].reverse(), [registros]);

  const totaisMes = useMemo(() => {
    const t = { marmitas: 0, receitaBruta: 0, recebido: 0, aReceber: 0 };
    for (const r of registros) {
      t.marmitas += r.totais.marmitas;
      t.receitaBruta += r.totais.receitaBruta;
      t.recebido += r.totais.recebido;
      t.aReceber += r.totais.aReceber;
    }
    return t;
  }, [registros]);

  const celulas = useMemo(() => {
    const desloc = new Date(alvo.ano, alvo.mes, 1).getDay();
    const lista: (string | null)[] = [];
    for (let i = 0; i < desloc; i++) lista.push(null);
    for (let d = 1; d <= ultimoDia; d++) lista.push(`${alvo.ano}-${pad(alvo.mes + 1)}-${pad(d)}`);
    return lista;
  }, [alvo, ultimoDia]);

  const rotuloMes = useMemo(() => {
    const texto = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
      new Date(alvo.ano, alvo.mes, 1),
    );
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }, [alvo]);

  const hojeData = deISO(hoje);
  const mesAtual = alvo.ano === hojeData.getFullYear() && alvo.mes === hojeData.getMonth();

  function andar(passo: number) {
    setDir(passo);
    setAlvo((a) => {
      const m = a.mes + passo;
      if (m < 0) return { ano: a.ano - 1, mes: 11 };
      if (m > 11) return { ano: a.ano + 1, mes: 0 };
      return { ano: a.ano, mes: m };
    });
  }

  function voltarHoje() {
    setDir(-1);
    setAlvo({ ano: hojeData.getFullYear(), mes: hojeData.getMonth() });
  }

  function tocarNoDia(iso: string) {
    const r = porData.get(iso);
    if (r) setAberta(iso);
    else toast.info(`Dia ${dataCurta(iso)} sem pedidos lançados`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 px-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-[22px] font-semibold leading-tight text-brand">Agenda</h1>
          <Botao variante="neutro" tamanho="sm" disabled={mesAtual} onClick={voltarHoje}>
            <CalendarDays size={14} />
            Hoje
          </Botao>
        </div>

        <div className="flex items-center gap-2">
          <Botao
            variante="neutro"
            tamanho="sm"
            aria-label="Mês anterior"
            onClick={() => andar(-1)}
            className="shrink-0"
          >
            <ChevronLeft size={16} />
          </Botao>
          <div className="flex min-w-0 flex-1 justify-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={`${alvo.ano}-${alvo.mes}`}
                layoutId="agenda-piloto-mes"
                custom={dir}
                initial={reduzido ? { opacity: 0 } : { opacity: 0, y: dir * 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduzido ? { opacity: 0 } : { opacity: 0, y: dir * -12 }}
                transition={MOLINHO}
                className="block max-w-full truncate rounded-full bg-brand-soft px-3 py-1.5 text-center font-display text-[15px] font-semibold text-brand"
              >
                {rotuloMes}
              </motion.span>
            </AnimatePresence>
          </div>
          <Botao
            variante="neutro"
            tamanho="sm"
            aria-label="Próximo mês"
            onClick={() => andar(1)}
            className="shrink-0"
          >
            <ChevronRight size={16} />
          </Botao>
        </div>
      </div>

      {diasQuery.isError || registrosQuery.isError ? (
        <Cartao className="flex flex-col items-start gap-2.5 border-gold-300 bg-gold-soft p-4">
          <p className="text-[13px] font-semibold leading-snug text-preparada-ink">
            Não consegui abrir a agenda deste mês. Verifique a internet e tente de novo.
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
          <Esqueleto className="h-[300px] rounded-[20px]" />
          <Esqueleto className="h-16 rounded-[18px]" />
          <Esqueleto className="h-16 rounded-[18px]" />
          <Esqueleto className="h-16 rounded-[18px]" />
        </div>
      ) : (
        <>
          <Cartao className="p-2.5">
            <div className="grid grid-cols-7 gap-1 pb-1">
              {DIAS_SEMANA.map((s, i) => (
                <span key={`${s}-${i}`} className="text-center text-[10px] font-bold uppercase text-tinta-3">
                  {s}
                </span>
              ))}
            </div>
            <motion.div
              key={`${alvo.ano}-${alvo.mes}`}
              variants={listaStagger}
              initial={reduzido ? "visivel" : "oculto"}
              animate="visivel"
              className="grid grid-cols-7 gap-1"
            >
              {celulas.map((iso, i) =>
                iso === null ? (
                  <span key={`vazio-${i}`} aria-hidden className="aspect-square" />
                ) : (
                  <motion.button
                    key={iso}
                    type="button"
                    variants={itemLista}
                    whileTap={apertar}
                    onClick={() => tocarNoDia(iso)}
                    aria-label={`Abrir ${dataLonga(iso)}`}
                    className={cn(
                      "flex aspect-square min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border",
                      porData.has(iso) ? "border-line bg-white shadow-suave" : "border-transparent",
                      iso === hoje && "ring-2 ring-brand",
                    )}
                  >
                    <span
                      className={cn(
                        "num text-[length:clamp(11px,3.2vw,14px)] font-bold leading-none",
                        porData.has(iso) ? "text-tinta" : "text-tinta-3",
                        iso === hoje && "text-brand",
                      )}
                    >
                      {Number(iso.slice(8))}
                    </span>
                    {porData.has(iso) && (
                      <>
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            pontoDoDia(porData.get(iso)!.totais) ?? "bg-neutro",
                          )}
                        />
                        <span className="num text-[9px] leading-none text-tinta-3">
                          {porData.get(iso)!.totais.marmitas}
                        </span>
                      </>
                    )}
                  </motion.button>
                ),
              )}
            </motion.div>
          </Cartao>

          {registros.length === 0 ? (
            <Cartao>
              <Vazio
                icone={<CalendarDays size={26} />}
                titulo="Mês sem marmitas"
                descricao="Nenhum dia lançado neste mês ainda. Quando colarmos pedidos do grupo, eles aparecem aqui."
                acao={
                  <Botao variante="dourado" tamanho="sm" onClick={() => ir("/dia")}>
                    Lançar um dia
                  </Botao>
                }
              />
            </Cartao>
          ) : (
            <section className="flex flex-col gap-2">
              <TituloSecao
                acao={<span className="num text-[11px] font-semibold text-tinta-3">{registros.length} dias</span>}
              >
                Dias do mês
              </TituloSecao>
              <motion.div
                key={`${alvo.ano}-${alvo.mes}`}
                variants={listaStagger}
                initial={reduzido ? "visivel" : "oculto"}
                animate="visivel"
                className="flex flex-col gap-2"
              >
                {decrescentes.map((r) => (
                  <LinhaDoDia
                    key={r.dia.id}
                    registro={r}
                    he={r.dia.data === hoje}
                    aoAbrir={() => setAberta(r.dia.data)}
                  />
                ))}
              </motion.div>

              <Cartao className="flex flex-col gap-2 p-4">
                <p className="font-display text-[15px] font-semibold text-brand">Resumo do mês</p>
                <div className="flex flex-col gap-1.5">
                  <NumeroLinia valor={String(totaisMes.marmitas)} rotulo="marmitas vendidas" cor="text-brand" />
                  <NumeroLinia valor={moeda(totaisMes.receitaBruta)} rotulo="receita bruta" cor="text-entregue-ink" />
                  <NumeroLinia valor={moeda(totaisMes.recebido)} rotulo="recebido no caixa" cor="text-paga-ink" />
                  <NumeroLinia valor={moeda(totaisMes.aReceber)} rotulo="a receber (PG)" cor="text-preparada-ink" />
                </div>
              </Cartao>
            </section>
          )}
        </>
      )}

      <Sheet
        aberto={detalhe !== null}
        aoFechar={() => setAberta(null)}
        titulo="Detalhe do dia"
        rodape={
          <Botao
            variante="primario"
            tamanho="lg"
            larguraTotal
            onClick={() => {
              const alvo = detalhe?.dia.data;
              if (alvo) ir(alvo === hoje ? "/dia" : `/dia?data=${alvo}`);
            }}
          >
            <CalendarDays size={17} />
            Abrir no dia
          </Botao>
        }
      >
        {detalhe && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={detalhe.dia.data}
              initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SUAVE}
            >
              <ConteudoDia
                registro={detalhe}
                nomeEntregador={nomeEntregador}
                reduzido={reduzido}
                aoReceber={darBaixa}
                salvando={salvarVendas.isPending || caixa.gravar.isPending}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </Sheet>
    </div>
  );
}

function LinhaDoDia({
  registro,
  he,
  aoAbrir,
}: {
  registro: ResumoDia;
  he: boolean;
  aoAbrir: () => void;
}) {
  const t = registro.totais;
  const restante = Math.max(0, t.marmitas - t.entregues);
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
        <span className={cn("min-w-0 flex-1 truncate text-[13px] font-semibold", he ? "text-brand" : "text-tinta")}>
          {dataCurta(registro.dia.data)} · {diaDaSemana(registro.dia.data).slice(0, 3)}
        </span>
        <Chip
          className={cn(
            "shrink-0 border-transparent px-2 py-0.5",
            t.marmitas === 0 ? "bg-crema-2 text-tinta-3" : "bg-brand-soft text-brand",
          )}
        >
          <span className="num">{t.marmitas}</span>
        </Chip>
        <span className="num shrink-0 text-[12px] font-bold text-paga-ink">
          <span className="mr-0.5 text-[9px] font-semibold text-tinta-3">R$</span>
          {soValor(t.recebido)}
        </span>
        {t.aReceber > 0 && (
          <span className="num shrink-0 rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-bold text-preparada-ink">
            +{soValor(t.aReceber)}
          </span>
        )}
        <ChevronRight size={15} className="shrink-0 text-tinta-3" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <Barra
            altura="h-1.5"
            partes={[
              { valor: t.entregues, cor: ENTREGUE.barra, chave: "entregue" },
              { valor: restante, cor: APARENCIA.pendente.barra, chave: "restante" },
            ]}
          />
        </span>
        <span className="num shrink-0 text-[10px] font-semibold text-tinta-3">
          {t.entregues}/{t.marmitas}
        </span>
      </div>
    </motion.button>
  );
}

function ConteudoDia({
  registro,
  nomeEntregador,
  reduzido,
  aoReceber,
  salvando,
}: {
  registro: ResumoDia;
  nomeEntregador: (id: string) => string;
  reduzido: boolean;
  aoReceber: (venda: Venda, dia: DiaVenda) => void;
  salvando: boolean;
}) {
  const t = registro.totais;
  const restante = Math.max(0, t.marmitas - t.entregues);
  const pgAberto = Math.max(0, t.pgQtd - t.pagaQtd);
  const clientes = topClientes(registro.vendas, 5);
  const devendo = registro.vendas.filter((v) => faltaReceber(v, registro.dia.precoMarmita) > 0);

  const agregado = new Map<string, number>();
  for (const v of registro.vendas) {
    if (v.status === "cancelada") continue;
    const chave = v.entreguePor ?? "";
    agregado.set(chave, (agregado.get(chave) ?? 0) + v.qtd);
  }
  const porEntregador = [...agregado.entries()]
    .map(([id, qtd]) => ({ id, nome: id ? nomeEntregador(id) : "sem registro", qtd }))
    .sort((a, b) => b.qtd - a.qtd);

  return (
    <div className="flex flex-col gap-3 pb-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="min-w-0 truncate font-display text-[16px] font-semibold text-brand">
          {dataLonga(registro.dia.data)}
        </p>
        <Chip className="num shrink-0 border-gold-300 bg-gold-soft text-preparada-ink">
          {registro.dia.precoMarmita > 0 ? `marmita ${moeda(registro.dia.precoMarmita)}` : "sem preço"}
        </Chip>
      </div>

      {registro.dia.prato && (
        <p className="flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-[13px] font-semibold text-brand">
          <Utensils size={15} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">{registro.dia.prato}</span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Medida rotulo="Marmitas" valor={t.marmitas} cor="text-brand" />
        <Medida rotulo="Montadas" valor={t.preparadas + t.entregues} cor="text-preparada-ink" />
        <Medida rotulo="Entregues" valor={t.entregues} cor="text-entregue" />
        <Medida rotulo="Pagas" valor={t.pagaQtd} cor="text-paga-ink" />
        <Medida rotulo="PG em aberto" valor={pgAberto} cor="text-gold-600" />
        <Medida rotulo="Receita bruta" valor={t.receitaBruta} cor="text-entregue-ink" dinheiro />
        <Medida rotulo="Recebido" valor={t.recebido} cor="text-paga-ink" dinheiro />
        <Medida rotulo="A receber" valor={t.aReceber} cor="text-preparada-ink" dinheiro />
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
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-tinta-3">
          <Legenda cor={ENTREGUE.ponto} texto={`${t.entregues} entregues`} />
          <Legenda cor={PREPARADA.ponto} texto={`${t.preparadas} prontas`} />
          <Legenda cor={APARENCIA.pendente.ponto} texto={`${restante} a entregar`} />
          {t.canceladas > 0 && <Legenda cor={APARENCIA.cancelada.ponto} texto={`${t.canceladas} canceladas`} />}
        </div>
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-1.5 px-1 font-display text-[15px] font-semibold text-brand">
          <CircleDollarSign size={15} />
          Quem ficou devendo
          {devendo.length > 0 && (
            <span className="num ml-auto text-[11px] font-semibold text-preparada-ink">{moeda(t.aReceber)}</span>
          )}
        </p>
        {devendo.length === 0 ? (
          <p className="rounded-xl bg-entregue/12 px-3 py-2 text-[12.5px] font-semibold text-entregue-ink">
            {t.pgQtd > 0 ? "Tudo prometido já foi recebido." : "Ninguém ficou de pagar neste dia."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {devendo.map((v, i) => (
              <motion.li
                key={v.id}
                initial={reduzido ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...MOLINHO, delay: i * 0.04 }}
                className="flex items-center gap-2 rounded-xl bg-paga-soft py-2 pr-2 pl-3"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-paga-ink">
                  {nomeParaExibir(v.cliente)}
                  <span className="num ml-1.5 text-[11px] font-bold text-tinta-3">×{v.qtd}</span>
                  {v.paga && <span className="ml-1.5 text-[10px] font-semibold text-preparada-ink">parcial</span>}
                </span>
                <span className="num shrink-0 text-[12.5px] font-bold text-preparada-ink">
                  {moeda(faltaReceber(v, registro.dia.precoMarmita))}
                </span>
                <Botao
                  variante="dourado"
                  tamanho="sm"
                  carregando={salvando}
                  className="h-8 shrink-0 gap-1 rounded-full px-3 text-[12px]"
                  onClick={() => aoReceber(v, registro.dia)}
                >
                  <Receipt size={13} />
                  Dar baixa
                </Botao>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-1.5 px-1 font-display text-[15px] font-semibold text-brand">
          <Bike size={15} />
          Quem entregou
        </p>
        {porEntregador.length === 0 ? (
          <p className="px-1 text-[13px] text-tinta-3">Nenhuma venda lançada nesse dia.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {porEntregador.map((e, i) => (
              <motion.li
                key={e.id || "sem-registro"}
                initial={reduzido ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...MOLINHO, delay: i * 0.04 }}
                className="flex items-center gap-2.5 rounded-xl bg-crema-2/70 py-2 pr-3 pl-3"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-tinta">{e.nome}</span>
                <span className="num shrink-0 text-[13px] font-bold text-brand">×{e.qtd}</span>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-1.5 px-1 font-display text-[15px] font-semibold text-brand">
          <Users size={15} />
          Mais pedidos
        </p>
        {clientes.length === 0 ? (
          <p className="px-1 text-[13px] text-tinta-3">Nenhum cliente lançado nesse dia.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {clientes.map((c, i) => (
              <motion.li
                key={c.chave}
                initial={reduzido ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...MOLINHO, delay: 0.05 + i * 0.04 }}
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

function Medida({
  rotulo,
  valor,
  cor,
  dinheiro,
}: {
  rotulo: string;
  valor: number;
  cor: string;
  dinheiro?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 rounded-2xl border border-line bg-white px-1 py-2.5">
      <NumeroAnimado
        valor={valor}
        formatar={dinheiro ? moeda : undefined}
        className={cn("font-display text-[length:clamp(13px,4.2vw,17px)] font-bold leading-none", cor)}
      />
      <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-wide text-tinta-3">
        {rotulo}
      </span>
    </div>
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

function NumeroLinia({ valor, rotulo, cor }: { valor: string; rotulo: string; cor: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-baseline gap-2">
      <span className={cn("num truncate text-right font-display text-[17px] font-bold", cor)}>{valor}</span>
      <span className="truncate text-[12px] text-tinta-3">{rotulo}</span>
    </div>
  );
}
