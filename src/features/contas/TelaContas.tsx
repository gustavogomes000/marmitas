import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Layers,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useTitulo } from "@/app/Layout";
import {
  estadoConta,
  gerarParcelas,
  idMovimentacaoConta,
  ordenarContas,
  proximaData,
  resumoContas,
  rotuloEstado,
} from "@/domain/contas";
import type { DadosParcelamento, EstadoConta, Intervalo } from "@/domain/contas";
import type { Categoria, Conta, FormaPagamento } from "@/domain/types";
import { AreaTexto, Botao, Campo, Cartao, Chip, Esqueleto, NumeroAnimado, Sheet, TituloSecao, Vazio } from "@/shared/components/ui";
import {
  useCategorias,
  useContas,
  useMovimentacaoRapida,
  useRemoverConta,
  useSalvarContas,
} from "@/shared/hooks/useDados";
import { useReduzirMovimento, vibrar } from "@/shared/hooks/useAnimacao";
import { cn } from "@/shared/lib/cn";
import { dataCurta, deISO, hojeISO, moeda, paraNumero } from "@/shared/lib/format";
import { MOLINHO, SUAVE, itemLista, listaStagger, subir } from "@/shared/lib/motion";
import { uid } from "@/shared/lib/storage";
import { CANCELADA, PAGA, PREPARADA } from "@/shared/lib/status";

const FORMAS: { id: FormaPagamento; rotulo: string }[] = [
  { id: "pix", rotulo: "Pix" },
  { id: "dinheiro", rotulo: "Dinheiro" },
  { id: "cartao", rotulo: "Cartão" },
  { id: "outro", rotulo: "Outro" },
];

const INTERVALOS: { id: Intervalo; rotulo: string }[] = [
  { id: "semana", rotulo: "Semanal" },
  { id: "quinzena", rotulo: "Quinzenal" },
  { id: "mes", rotulo: "Mensal" },
];

type Filtro = "todas" | "vencidas" | "a_vencer" | "futuras" | "pagas";

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "vencidas", rotulo: "Vencidas" },
  { id: "a_vencer", rotulo: "A vencer" },
  { id: "futuras", rotulo: "Futuras" },
  { id: "pagas", rotulo: "Pagas" },
];

// Vermelho sobre fundo claro: nunca texto vermelho sobre o borgonha do app.
const CORES_ESTADO: Record<EstadoConta, string> = {
  vencida: CANCELADA.chip,
  hoje: PREPARADA.chip,
  proxima: PREPARADA.chip,
  futura: "border-line bg-crema-2 text-tinta-3",
  paga: PAGA.chip,
};

function textoDoValor(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}

function limparDigitacao(novo: string): string {
  const digitados = novo.replace(/[^\d,]/g, "");
  const temVirgula = digitados.includes(",");
  const [inteiraBruta = "", ...decimais] = digitados.split(",");
  const inteira = inteiraBruta.replace(/^0+(?=\d)/, "").slice(0, 8);
  return temVirgula ? `${inteira},${decimais.join("").slice(0, 2)}` : inteira;
}

function dataCompleta(iso: string): string {
  const d = deISO(iso);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const dia = `${d.getDate()}`.padStart(2, "0");
  return `${dia}/${m}/${d.getFullYear()}`;
}

function linhaDeVencimento(conta: Conta): string {
  const quando = conta.paga ? `paga em ${dataCurta(conta.pagoEm ?? conta.vencimento)}` : `vence ${dataCurta(conta.vencimento)}`;
  return conta.fornecedor.trim() ? `${conta.fornecedor} · ${quando}` : quando;
}

type SalvarContas = ReturnType<typeof useSalvarContas>;
type RemoverConta = ReturnType<typeof useRemoverConta>;
type CaixaRapido = ReturnType<typeof useMovimentacaoRapida>;

export function TelaContas() {
  useTitulo("Contas");
  const reduzido = useReduzirMovimento();
  const hoje = useMemo(() => hojeISO(), []);

  const contasQuery = useContas();
  const categoriasQuery = useCategorias();
  const salvarContas = useSalvarContas();
  const removerConta = useRemoverConta();
  const caixa = useMovimentacaoRapida();

  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [pagando, setPagando] = useState<Conta | null>(null);
  const [criando, setCriando] = useState<"nova" | "parcelar" | null>(null);
  const [removendo, setRemovendo] = useState<Conta | null>(null);
  const [pagasAbertas, setPagasAbertas] = useState(false);

  const contas = useMemo(() => contasQuery.data ?? [], [contasQuery.data]);
  const resumo = useMemo(() => resumoContas(contas, hoje), [contas, hoje]);
  const ordenadas = useMemo(() => ordenarContas(contas, hoje), [contas, hoje]);

  const saidas = useMemo(
    () => (categoriasQuery.data ?? []).filter((c) => c.fluxo === "saida"),
    [categoriasQuery.data],
  );

  const mesAtual = hoje.slice(0, 7);

  const { principais, pagasMes } = useMemo(() => {
    if (filtro === "pagas") {
      const todasPagas = contas
        .filter((c) => c.paga)
        .sort((a, b) => ((b.pagoEm ?? "") < (a.pagoEm ?? "") ? -1 : 1));
      return { principais: todasPagas, pagasMes: [] as Conta[] };
    }
    if (filtro === "todas") {
      const abertas = ordenadas.filter((c) => !c.paga);
      const pagasMes = ordenadas.filter((c) => c.paga && (c.pagoEm ?? "").slice(0, 7) === mesAtual);
      return { principais: abertas, pagasMes };
    }
    const alvos: EstadoConta[] =
      filtro === "vencidas" ? ["vencida"] : filtro === "a_vencer" ? ["hoje", "proxima"] : ["futura"];
    const filtradas = ordenadas.filter((c) => !c.paga && alvos.includes(estadoConta(c, hoje)));
    return { principais: filtradas, pagasMes: [] as Conta[] };
  }, [contas, ordenadas, filtro, hoje, mesAtual]);

  const semContas = contas.length === 0;
  const carregando = contasQuery.isPending;
  const deuErro = contasQuery.isError;

  async function alternarPago(conta: Conta) {
    if (conta.paga) {
      await removerMovimentoEReabrir(conta);
      return;
    }
    setPagando(conta);
  }

  async function removerMovimentoEReabrir(conta: Conta) {
    try {
      await caixa.apagar.mutateAsync(idMovimentacaoConta(conta.id));
      await salvarContas.mutateAsync([{ ...conta, paga: false, pagoEm: null }]);
      vibrar(12);
      toast('Conta voltada para "a vencer"');
    } catch {
      toast.error("Não deu para voltar agora. Tente de novo.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <motion.section variants={subir} initial={reduzido ? "visivel" : "oculto"} animate="visivel" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h1 className="min-w-0 truncate font-display text-[22px] font-semibold text-brand">Contas a pagar</h1>
          <span className="num shrink-0 whitespace-nowrap text-[11.5px] font-semibold text-tinta-3">
            {ordenadas.filter((c) => !c.paga).length} em aberto
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Botao variante="dourado" tamanho="md" onClick={() => setCriando("parcelar")} className="gap-1.5">
            <Layers size={17} />
            <span className="min-w-0 truncate">Parcelar compra</span>
          </Botao>
          <Botao variante="primario" tamanho="md" onClick={() => setCriando("nova")} className="gap-1.5">
            <Plus size={18} strokeWidth={2.6} />
            Nova conta
          </Botao>
        </div>
      </motion.section>

      {deuErro ? (
        <Cartao className="flex flex-col items-start gap-2.5 border-gold-300 bg-gold-soft p-4">
          <div className="flex items-center gap-2">
            <TriangleAlert size={16} className="shrink-0 text-preparada-ink" />
            <p className="min-w-0 truncate text-[13px] font-semibold text-preparada-ink">
              Não deu para carregar as contas.
            </p>
          </div>
          <Botao variante="dourado" tamanho="sm" carregando={contasQuery.isFetching} onClick={() => void contasQuery.refetch()} className="gap-1.5">
            <RotateCcw size={15} />
            Tentar de novo
          </Botao>
        </Cartao>
      ) : (
        <motion.section variants={subir} initial={reduzido ? "visivel" : "oculto"} animate="visivel">
          {carregando ? (
            <Esqueleto className="h-[132px]" />
          ) : (
            <Cartao className="grid grid-cols-2 gap-x-3 gap-y-4 p-4">
              <ResumoItem valor={resumo.abertas} rotulo="A vencer" cor="text-brand" />
              <ResumoItem valor={resumo.vencidas} rotulo="Vencidas" cor="text-cancelada" />
              <ResumoItem valor={resumo.vencendoSemana} rotulo="Vencendo em 7 dias" cor="text-preparada-ink" />
              <ResumoItem valor={resumo.pagas} rotulo="Pagas" cor="text-entregue" />
            </Cartao>
          )}
        </motion.section>
      )}

      {!carregando && !deuErro && !semContas && (
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTROS.map((f) => (
            <Pill key={f.id} grupo="filtro" ativo={f.id === filtro} onClick={() => setFiltro(f.id)}>
              {f.rotulo}
            </Pill>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-2.5">
        {carregando ? (
          <div className="flex flex-col gap-2.5">
            <Esqueleto className="h-[92px]" />
            <Esqueleto className="h-[92px]" />
            <Esqueleto className="h-[92px]" />
          </div>
        ) : deuErro ? null : semContas ? (
          <Cartao className="p-2">
            <Vazio
              icone={<Receipt size={26} />}
              titulo="Nenhuma conta lançada"
              descricao="Anote o que você compra no crédito e divida as compras grandes em parcelas — o app avisa quando cada uma vence."
              acao={
                <Botao variante="primario" tamanho="md" onClick={() => setCriando("nova")} className="gap-1.5">
                  <Plus size={18} strokeWidth={2.6} />
                  Nova conta
                </Botao>
              }
            />
          </Cartao>
        ) : (
          <>
            <TituloSecao
              acao={
                <span className="num whitespace-nowrap text-[11px] font-semibold text-tinta-3">{principais.length}</span>
              }
            >
              <span className="min-w-0 truncate">{FILTROS.find((f) => f.id === filtro)?.rotulo}</span>
            </TituloSecao>
            {principais.length === 0 ? (
              <Cartao className="px-4 py-5 text-center">
                <p className="min-w-0 truncate text-[12.5px] text-tinta-2">
                  Nada nesta lista agora — troque o filtro acima.
                </p>
              </Cartao>
            ) : (
              <motion.ul
                variants={listaStagger}
                initial={reduzido ? "visivel" : "oculto"}
                animate="visivel"
                className="flex flex-col gap-2"
              >
                <AnimatePresence initial={false}>
                  {principais.map((conta) => (
                    <LinhaConta
                      key={conta.id}
                      conta={conta}
                      hoje={hoje}
                      aoPagar={() => alternarPago(conta)}
                      aoRemover={() => setRemovendo(conta)}
                    />
                  ))}
                </AnimatePresence>
              </motion.ul>
            )}

            {filtro === "todas" && pagasMes.length > 0 && (
              <div className="mt-1 flex flex-col gap-2">
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  onClick={() => setPagasAbertas((a) => !a)}
                  className="h-11 justify-between gap-2 px-1 text-brand"
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="font-display text-[15px] font-semibold">Pagas este mês</span>
                    <span className="num shrink-0 text-[11px] font-semibold text-tinta-3">{pagasMes.length}</span>
                  </span>
                  <ChevronDown
                    size={18}
                    className={cn("shrink-0 transition-transform", pagasAbertas && "rotate-180")}
                  />
                </Botao>
                <AnimatePresence initial={false}>
                  {pagasAbertas && (
                    <motion.ul
                      variants={listaStagger}
                      initial="oculto"
                      animate="visivel"
                      exit={{ opacity: 0, height: 0 }}
                      transition={SUAVE}
                      className="flex flex-col gap-2 overflow-hidden"
                    >
                      {pagasMes.map((conta) => (
                        <LinhaConta
                          key={conta.id}
                          conta={conta}
                          hoje={hoje}
                          aoPagar={() => alternarPago(conta)}
                          aoRemover={() => setRemovendo(conta)}
                        />
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </section>

      {pagando && (
        <PainelPagamento
          key={pagando.id}
          conta={pagando}
          hoje={hoje}
          salvar={salvarContas}
          caixa={caixa}
          aoFechar={() => setPagando(null)}
        />
      )}

      {criando === "nova" && (
        <PainelNovaConta
          hoje={hoje}
          categorias={saidas}
          carregandoCategorias={categoriasQuery.isPending}
          salvar={salvarContas}
          aoFechar={() => setCriando(null)}
        />
      )}

      {criando === "parcelar" && (
        <PainelParcelar
          hoje={hoje}
          categorias={saidas}
          carregandoCategorias={categoriasQuery.isPending}
          salvar={salvarContas}
          aoFechar={() => setCriando(null)}
        />
      )}

      {removendo && (
        <PainelRemover
          conta={removendo}
          remover={removerConta}
          caixa={caixa}
          aoFechar={() => setRemovendo(null)}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- resumo topo */

function ResumoItem({ valor, rotulo, cor }: { valor: number; rotulo: string; cor: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <NumeroAnimado
        valor={valor}
        formatar={moeda}
        className={cn("whitespace-nowrap font-display text-[clamp(1.15rem,4.6vw,1.45rem)] font-semibold leading-none", cor)}
      />
      <span className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-tinta-3">{rotulo}</span>
    </div>
  );
}

/* ---------------------------------------------------------------------- linha */

function LinhaConta({
  conta,
  hoje,
  aoPagar,
  aoRemover,
}: {
  conta: Conta;
  hoje: string;
  aoPagar: () => void;
  aoRemover: () => void;
}) {
  const estado = estadoConta(conta, hoje);
  const badge = conta.parcelas != null && conta.parcela != null ? `${conta.parcela}/${conta.parcelas}` : null;
  return (
    <motion.li
      layout
      variants={itemLista}
      initial="oculto"
      animate="visivel"
      exit="saindo"
      className={cn(
        "card flex flex-col gap-2.5 overflow-hidden p-3",
        conta.paga && "border-paga/25",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", estado === "vencida" ? CANCELADA.ponto : estado === "paga" ? PAGA.ponto : estado === "futura" ? "bg-tinta-3/40" : PREPARADA.ponto)} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className={cn("min-w-0 flex-1 truncate text-[14px] font-semibold", conta.paga ? "text-tinta-2" : "text-tinta")}>
              {conta.descricao}
            </p>
            {badge && (
              <span
                title={`parcela ${conta.parcela} de ${conta.parcelas}`}
                className="num shrink-0 whitespace-nowrap rounded-full border border-gold-300 bg-gold-soft px-2 py-0.5 text-[10.5px] font-bold text-preparada-ink"
              >
                {badge}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1">
            <CalendarDays size={12} className="shrink-0 text-tinta-3" />
            <span className="min-w-0 truncate text-[11.5px] text-tinta-3">{linhaDeVencimento(conta)}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn("num whitespace-nowrap text-[15px] font-semibold", conta.paga ? "text-tinta-3 line-through" : "text-tinta")}>
            {moeda(conta.valor)}
          </span>
          <Chip className={CORES_ESTADO[estado]}>{rotuloEstado(estado)}</Chip>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {conta.paga ? (
          <Botao variante="sucesso" tamanho="sm" onClick={aoPagar} className="min-w-0 flex-1 gap-1.5">
            <Check size={15} />
            Pago
          </Botao>
        ) : (
          <Botao variante="primario" tamanho="sm" onClick={aoPagar} className="min-w-0 flex-1">
            Pagar
          </Botao>
        )}
        <Botao variante="fantasma" tamanho="sm" aria-label="Remover conta" onClick={aoRemover} className="w-11 shrink-0 px-0 text-saida">
          <Trash2 size={17} />
        </Botao>
      </div>
    </motion.li>
  );
}

/* --------------------------------------------------------------------- pill */

function Pill({
  ativo,
  grupo,
  pilha = "bg-brand",
  texto = "text-crema",
  onClick,
  children,
}: {
  ativo: boolean;
  grupo: string;
  pilha?: string;
  texto?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Botao
      variante="fantasma"
      tamanho="sm"
      onClick={onClick}
      className={cn(
        "relative min-h-10 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold",
        ativo ? cn("border-transparent", texto) : "border-line bg-white text-tinta-2",
      )}
    >
      {ativo && (
        <motion.span layoutId={`piloto-${grupo}`} transition={MOLINHO} className={cn("absolute inset-0 rounded-full", pilha)} />
      )}
      <span className="relative">{children}</span>
    </Botao>
  );
}

/* ------------------------------------------------------------------ seleção */

function Selecao({
  rotulo,
  value,
  onChange,
  children,
  erro,
  disabled,
}: {
  rotulo: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  erro?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <select
          aria-label={rotulo}
          value={value}
          disabled={disabled}
          onChange={onChange}
          className={cn(
            "h-12 w-full appearance-none rounded-2xl border border-line bg-white px-4 pr-11 text-[16px] shadow-dentro",
            "focus:border-brand focus:ring-4 focus:ring-brand/10 focus:outline-none disabled:opacity-50",
            erro && "border-cancelada ring-4 ring-cancelada/10",
          )}
        >
          {children}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-tinta-3" />
      </div>
      <AnimatePresence>
        {erro && (
          <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pl-1 text-xs font-semibold text-cancelada">
            {erro}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stepper({ valor, aoMudar }: { valor: number; aoMudar: (n: number) => void }) {
  const minuscar = () => aoMudar(Math.max(2, valor - 1));
  const somar = () => aoMudar(Math.min(24, valor + 1));
  return (
    <div className="flex items-stretch gap-2">
      <Botao variante="neutro" tamanho="md" aria-label="Menos parcelas" onClick={minuscar} disabled={valor <= 2} className="w-13 shrink-0 px-0">
        <span className="text-xl font-bold leading-none">−</span>
      </Botao>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl border border-line bg-white px-3 shadow-dentro">
        <span className="num text-[15px] font-semibold text-tinta">{valor}×</span>
        <span className="text-[9.5px] font-semibold uppercase tracking-wide text-tinta-3">parcelas</span>
      </div>
      <Botao variante="neutro" tamanho="md" aria-label="Mais parcelas" onClick={somar} disabled={valor >= 24} className="w-13 shrink-0 px-0">
        <span className="text-xl font-bold leading-none">+</span>
      </Botao>
    </div>
  );
}

function SheetCorpo({ children }: { children: ReactNode }) {
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

/* ------------------------------------------------------------ painel pagar */

function PainelPagamento({
  conta,
  hoje,
  salvar,
  caixa,
  aoFechar,
}: {
  conta: Conta;
  hoje: string;
  salvar: SalvarContas;
  caixa: CaixaRapido;
  aoFechar: () => void;
}) {
  const [valorTexto, setValorTexto] = useState(textoDoValor(conta.valor));
  const [data, setData] = useState(hoje);
  const [forma, setForma] = useState<FormaPagamento>(conta.forma);
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<string>();

  const valor = paraNumero(valorTexto);
  const carregando = salvar.isPending || caixa.gravar.isPending;
  const rotuloParcela = conta.parcelas != null && conta.parcela != null ? ` (${conta.parcela}/${conta.parcelas})` : "";

  async function confirmar() {
    const centavos = Math.round(valor * 100) / 100;
    if (centavos <= 0 || !data) {
      setErro(centavos <= 0 ? "Digite um valor maior que zero" : "Informe a data do pagamento");
      vibrar([10, 40, 10]);
      return;
    }
    try {
      await salvar.mutateAsync([{ ...conta, paga: true, pagoEm: data }]);
      await caixa.gravar.mutateAsync({
        id: idMovimentacaoConta(conta.id),
        data,
        descricao: `${conta.descricao}${rotuloParcela}`,
        valor: centavos,
        fluxo: "saida",
        categoriaId: conta.categoriaId,
        forma,
        obs: nota.trim(),
        criadoEm: new Date().toISOString(),
      });
      vibrar([8, 20, 8]);
      toast.success(`${moeda(centavos)} pagos`, { description: conta.fornecedor.trim() || conta.descricao });
      aoFechar();
    } catch {
      toast.error("Não registrou o pagamento agora. Tente de novo.");
    }
  }

  return (
    <Sheet
      aberto
      aoFechar={aoFechar}
      titulo="Pagamento da conta"
      rodape={
        <Botao variante="primario" tamanho="lg" larguraTotal disabled={carregando} carregando={carregando} onClick={confirmar}>
          Confirmar pagamento
        </Botao>
      }
    >
      <SheetCorpo>
        <div className="rounded-2xl bg-brand-soft px-3.5 py-3">
          <p className="min-w-0 truncate text-[13.5px] font-semibold text-brand">{conta.descricao}{rotuloParcela}</p>
          <p className="mt-0.5 min-w-0 truncate text-[11.5px] text-tinta-2">{linhaDeVencimento(conta)}</p>
        </div>

        <Campo
          rotulo="Valor pago"
          prefixo="R$"
          inputMode="decimal"
          value={valorTexto}
          onChange={(e) => {
            setValorTexto(limparDigitacao(e.target.value));
            if (erro) setErro(undefined);
          }}
          erro={erro}
          dica="0,00"
        />

        <Campo rotulo="Data do pagamento" type="date" value={data} onChange={(e) => setData(e.target.value)} />

        <div className="flex flex-col gap-2">
          <p className="pl-1 text-[13px] font-semibold text-tinta-2">Forma de pagamento</p>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FORMAS.map((f) => (
              <Pill key={f.id} grupo="forma-pagamento" pilha="bg-gold" texto="text-brand-ink" ativo={f.id === forma} onClick={() => setForma(f.id)}>
                {f.rotulo}
              </Pill>
            ))}
          </div>
        </div>

        <Campo rotulo="Observação (opcional)" dica="Ex.: pago no balcão" value={nota} maxLength={120} onChange={(e) => setNota(e.target.value)} />
      </SheetCorpo>
    </Sheet>
  );
}

/* --------------------------------------------------------- painel nova conta */

function PainelNovaConta({
  hoje,
  categorias,
  carregandoCategorias,
  salvar,
  aoFechar,
}: {
  hoje: string;
  categorias: Categoria[];
  carregandoCategorias: boolean;
  salvar: SalvarContas;
  aoFechar: () => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [valorTexto, setValorTexto] = useState("");
  const [vencimento, setVencimento] = useState(hoje);
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [forma, setForma] = useState<FormaPagamento>("dinheiro");
  const [obs, setObs] = useState("");
  const [erros, setErros] = useState<{ descricao?: string; valor?: string; vencimento?: string; categoria?: string }>({});

  const valor = paraNumero(valorTexto);

  function confirmar() {
    const centavos = Math.round(valor * 100) / 100;
    const novos: typeof erros = {};
    if (!descricao.trim()) novos.descricao = "Informe a descrição";
    if (centavos <= 0) novos.valor = "Digite um valor maior que zero";
    if (!vencimento) novos.vencimento = "Informe o vencimento";
    if (!categoriaId) novos.categoria = "Escolha uma categoria";
    setErros(novos);
    if (Object.keys(novos).length > 0) {
      vibrar([10, 40, 10]);
      return;
    }
    const conta: Conta = {
      id: uid("con"),
      descricao: descricao.trim(),
      fornecedor: fornecedor.trim(),
      valor: centavos,
      vencimento,
      categoriaId,
      forma,
      paga: false,
      pagoEm: null,
      grupo: null,
      parcela: null,
      parcelas: null,
      obs: obs.trim(),
    };
    salvar.mutate([conta], {
      onSuccess: () => {
        vibrar(12);
        toast.success(`Conta de ${moeda(centavos)} lançada`);
        aoFechar();
      },
      onError: () => toast.error("Não salvou agora. Tente de novo."),
    });
  }

  return (
    <Sheet
      aberto
      aoFechar={aoFechar}
      titulo="Nova conta"
      rodape={
        <Botao variante="primario" tamanho="lg" larguraTotal disabled={salvar.isPending} carregando={salvar.isPending} onClick={confirmar}>
          Lançar conta
        </Botao>
      }
    >
      <SheetCorpo>
        <Campo
          rotulo="Descrição"
          dica="Ex.: compra do mês"
          value={descricao}
          maxLength={60}
          onChange={(e) => setDescricao(e.target.value)}
          erro={erros.descricao}
        />
        <Campo rotulo="Fornecedor" dica="Ex.: Atacadão" value={fornecedor} maxLength={40} onChange={(e) => setFornecedor(e.target.value)} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo
            rotulo="Valor"
            prefixo="R$"
            inputMode="decimal"
            value={valorTexto}
            onChange={(e) => setValorTexto(limparDigitacao(e.target.value))}
            erro={erros.valor}
            dica="0,00"
          />
          <Campo rotulo="Vencimento" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} erro={erros.vencimento} />
        </div>

        <div className="flex flex-col gap-2">
          <p className="pl-1 text-[13px] font-semibold text-tinta-2">Categoria</p>
          {carregandoCategorias ? (
            <Esqueleto className="h-12 rounded-2xl" />
          ) : (
            <Selecao rotulo="Categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} erro={erros.categoria}>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.nome}
                </option>
              ))}
            </Selecao>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="pl-1 text-[13px] font-semibold text-tinta-2">Forma</p>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FORMAS.map((f) => (
              <Pill key={f.id} grupo="forma-nova" pilha="bg-gold" texto="text-brand-ink" ativo={f.id === forma} onClick={() => setForma(f.id)}>
                {f.rotulo}
              </Pill>
            ))}
          </div>
        </div>

        <AreaTexto rotulo="Observação (opcional)" dica="Detalhe que vale lembrar" value={obs} maxLength={160} onChange={(e) => setObs(e.target.value)} />
      </SheetCorpo>
    </Sheet>
  );
}

/* ----------------------------------------------------------- painel parcelar */

function PainelParcelar({
  hoje,
  categorias,
  carregandoCategorias,
  salvar,
  aoFechar,
}: {
  hoje: string;
  categorias: Categoria[];
  carregandoCategorias: boolean;
  salvar: SalvarContas;
  aoFechar: () => void;
}) {
  const [valorTexto, setValorTexto] = useState("");
  const [n, setN] = useState(10);
  const [intervalo, setIntervalo] = useState<Intervalo>("mes");
  const [primeira, setPrimeira] = useState(hoje);
  const [descricao, setDescricao] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [forma, setForma] = useState<FormaPagamento>("cartao");
  const [erros, setErros] = useState<{ valor?: string; primeira?: string; descricao?: string; categoria?: string }>({});

  const valorTotal = paraNumero(valorTexto);
  const cada = valorTotal > 0 ? Math.round((valorTotal * 100) / n) / 100 : 0;
  const ultimaIso = primeira ? proximaData(primeira, intervalo, n - 1) : "";

  function confirmar() {
    const novos: typeof erros = {};
    if (Math.round(valorTotal * 100) <= 0) novos.valor = "Digite o valor total da compra";
    if (!descricao.trim()) novos.descricao = "Informe a descrição";
    if (!primeira) novos.primeira = "Informe a 1ª vencimento";
    if (!categoriaId) novos.categoria = "Escolha uma categoria";
    setErros(novos);
    if (Object.keys(novos).length > 0) {
      vibrar([10, 40, 10]);
      return;
    }
    const dados: DadosParcelamento = {
      descricao: descricao.trim(),
      fornecedor: fornecedor.trim(),
      categoriaId,
      forma,
      primeiraVencimento: primeira,
    };
    const lista = gerarParcelas(dados, valorTotal, n, intervalo);
    salvar.mutate(lista, {
      onSuccess: () => {
        vibrar([8, 20, 8]);
        toast.success(`${n} parcelas de ${moeda(cada)}`, { description: `total ${moeda(valorTotal)}` });
        aoFechar();
      },
      onError: () => toast.error("Não parcelou agora. Tente de novo."),
    });
  }

  return (
    <Sheet
      aberto
      aoFechar={aoFechar}
      titulo="Parcelar compra"
      rodape={
        <Botao variante="primario" tamanho="lg" larguraTotal disabled={salvar.isPending} carregando={salvar.isPending} onClick={confirmar}>
          Parcelar em {n}×
        </Botao>
      }
    >
      <SheetCorpo>
        <Campo
          rotulo="Valor total"
          prefixo="R$"
          inputMode="decimal"
          value={valorTexto}
          onChange={(e) => setValorTexto(limparDigitacao(e.target.value))}
          erro={erros.valor}
          dica="0,00"
        />

        <div className="flex flex-col gap-2">
          <p className="pl-1 text-[13px] font-semibold text-tinta-2">Parcelas</p>
          <Stepper valor={n} aoMudar={setN} />
        </div>

        <div className="flex flex-col gap-2">
          <p className="pl-1 text-[13px] font-semibold text-tinta-2">Intervalo entre parcelas</p>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {INTERVALOS.map((i) => (
              <Pill key={i.id} grupo="intervalo" ativo={i.id === intervalo} onClick={() => setIntervalo(i.id)}>
                {i.rotulo}
              </Pill>
            ))}
          </div>
        </div>

        <Campo rotulo="Primeira vencimento" type="date" value={primeira} onChange={(e) => setPrimeira(e.target.value)} erro={erros.primeira} />

        <div className="rounded-2xl bg-brand-soft px-3.5 py-3 text-center">
          <p className="num min-w-0 truncate text-[12.5px] font-semibold text-brand">
            {valorTotal > 0
              ? `${n}× de ${moeda(cada)} · total ${moeda(valorTotal)}${ultimaIso ? ` · última em ${dataCompleta(ultimaIso)}` : ""}`
              : "Digite o valor para ver o parcelamento"}
          </p>
        </div>

        <Campo
          rotulo="Descrição"
          dica="Ex.: geladeira nova"
          value={descricao}
          maxLength={60}
          onChange={(e) => setDescricao(e.target.value)}
          erro={erros.descricao}
        />
        <Campo rotulo="Fornecedor" dica="Ex.: Magazine" value={fornecedor} maxLength={40} onChange={(e) => setFornecedor(e.target.value)} />

        <div className="flex flex-col gap-2">
          <p className="pl-1 text-[13px] font-semibold text-tinta-2">Categoria</p>
          {carregandoCategorias ? (
            <Esqueleto className="h-12 rounded-2xl" />
          ) : (
            <Selecao rotulo="Categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} erro={erros.categoria}>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.nome}
                </option>
              ))}
            </Selecao>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="pl-1 text-[13px] font-semibold text-tinta-2">Forma</p>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FORMAS.map((f) => (
              <Pill key={f.id} grupo="forma-parcelar" pilha="bg-gold" texto="text-brand-ink" ativo={f.id === forma} onClick={() => setForma(f.id)}>
                {f.rotulo}
              </Pill>
            ))}
          </div>
        </div>
      </SheetCorpo>
    </Sheet>
  );
}

/* ----------------------------------------------------------- painel remover */

function PainelRemover({
  conta,
  remover,
  caixa,
  aoFechar,
}: {
  conta: Conta;
  remover: RemoverConta;
  caixa: CaixaRapido;
  aoFechar: () => void;
}) {
  const carregando = remover.isPending || caixa.apagar.isPending;
  async function confirmar() {
    try {
      if (conta.paga) await caixa.apagar.mutateAsync(idMovimentacaoConta(conta.id));
      await remover.mutateAsync(conta.id);
      vibrar(20);
      toast.success("Conta removida");
      aoFechar();
    } catch {
      toast.error("Não removeu agora. Tente de novo.");
    }
  }

  return (
    <Sheet
      aberto
      aoFechar={aoFechar}
      titulo="Remover conta"
      rodape={
        <div className="flex items-center gap-2">
          <Botao variante="neutro" tamanho="md" onClick={aoFechar} className="flex-1">
            Manter
          </Botao>
          <Botao variante="perigo" tamanho="md" disabled={carregando} carregando={carregando} onClick={confirmar} className="flex-1 gap-1.5">
            <Trash2 size={16} />
            Confirmar
          </Botao>
        </div>
      }
    >
      <SheetCorpo>
        <div className="rounded-2xl bg-cancelada/8 px-3.5 py-3">
          <p className="min-w-0 truncate text-[13.5px] font-semibold text-cancelada-ink">{conta.descricao}</p>
          <p className="num mt-0.5 text-[11.5px] text-tinta-2">{moeda(conta.valor)} · vence {dataCurta(conta.vencimento)}</p>
        </div>
        <p className="px-1 text-[12.5px] leading-snug text-tinta-2">
          {conta.paga
            ? "Esta conta já foi paga. Remover também tira o lançamento do caixa."
            : "A conta sai da lista e não volta mais."}
        </p>
      </SheetCorpo>
    </Sheet>
  );
}
