import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bike, Check, ChevronRight, PackageOpen, Phone, Plus, RotateCcw, Trash2, Undo2, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import type { Entregador, StatusVenda, Venda } from "@/domain/types";
import { APARENCIA } from "@/shared/lib/status";
import {
  Barra,
  Botao,
  Campo,
  Cartao,
  Chip,
  Esqueleto,
  NumeroAnimado,
  Sheet,
  TituloSecao,
  Vazio,
} from "@/shared/components/ui";
import { useDia, useEntregadores, useRemoverEntregador, useSalvarEntregador, useSalvarVendas } from "@/shared/hooks/useDados";
import { useTitulo } from "@/app/Layout";
import { hojeISO } from "@/shared/lib/format";
import { MOLINHO, MOLINHO_FIRME, apertar } from "@/shared/lib/motion";
import { vibrar } from "@/shared/hooks/useAnimacao";
import { uid } from "@/shared/lib/storage";
import { cn } from "@/shared/lib/cn";

const STATUS_OPCOES: StatusVenda[] = ["pendente", "preparada", "entregue"];

function iniciais(nome: string): string {
  return nome.trim().charAt(0).toUpperCase() || "?";
}

function telHref(telefone: string): string {
  return `tel:${telefone.replace(/[^\d+]/g, "")}`;
}

export function TelaEntregas() {
  useTitulo("Entregas");
  const hoje = hojeISO();
  const diaQ = useDia(hoje);
  const entQ = useEntregadores();
  const salvar = useSalvarVendas(hoje);
  const salvarE = useSalvarEntregador();
  const removerE = useRemoverEntregador();

  const [aba, setAba] = useState<string>("todos");
  const [soSem, setSoSem] = useState(false);
  const [popId, setPopId] = useState<string | null>(null);
  const [editando, setEditando] = useState<Venda | null>(null);
  const [prefill, setPrefill] = useState(false);
  const [folha, setFolha] = useState<{ dados: Entregador; novo: boolean } | null>(null);

  const vendas = diaQ.data?.vendas ?? [];
  const entregadores = entQ.data ?? [];
  const ativos = useMemo(() => entregadores.filter((e) => e.ativo), [entregadores]);
  const mapaNome = useMemo(
    () => Object.fromEntries(entregadores.map((e) => [e.id, e.nome])),
    [entregadores],
  );
  const ativas = useMemo(() => vendas.filter((v) => v.status !== "cancelada"), [vendas]);

  const entregues = diaQ.data?.totais.entregues ?? 0;
  const marmitas = diaQ.data?.totais.marmitas ?? 0;
  const restante = Math.max(0, marmitas - entregues);
  const percentual = marmitas > 0 ? Math.round((entregues / marmitas) * 100) : 0;
  const linhasFaltando = ativas.filter((v) => v.status !== "entregue").length;

  const porEntregador = useMemo(() => {
    const m: Record<string, number> = {};
    for (const v of ativas) if (v.entreguePor) m[v.entreguePor] = (m[v.entreguePor] ?? 0) + v.qtd;
    return m;
  }, [ativas]);
  const entreguesPor = useMemo(() => {
    const m: Record<string, number> = {};
    for (const v of ativas)
      if (v.status === "entregue" && v.entreguePor)
        m[v.entreguePor] = (m[v.entreguePor] ?? 0) + v.qtd;
    return m;
  }, [ativas]);
  const semEntregadorLinhas = ativas.filter((v) => !v.entreguePor).length;

  const lista = useMemo(() => {
    let filtrada = ativas;
    if (soSem) filtrada = filtrada.filter((v) => !v.entreguePor);
    else if (aba !== "todos") filtrada = filtrada.filter((v) => v.entreguePor === aba);
    return [...filtrada].sort((a, b) => {
      const da = a.paga ? 1 : 0;
      const db = b.paga ? 1 : 0;
      return da - db || a.ordem - b.ordem || a.id.localeCompare(b.id);
    });
  }, [ativas, soSem, aba]);

  function darPop(id: string) {
    setPopId(id);
    window.setTimeout(() => setPopId((atual) => (atual === id ? null : atual)), 480);
  }

  function aplicarEntregue(nova: Venda, antiga: Venda) {
    darPop(nova.id);
    vibrar();
    const ganhou = !antiga.entreguePor && nova.entreguePor ? mapaNome[nova.entreguePor] : undefined;
    salvar.mutate([nova], {
      onSuccess: () =>
        toast.success("Entregue!", {
          description: ganhou ? `${nova.cliente} · ${ganhou}` : nova.cliente,
          duration: 6000,
          action: {
            label: "Desfazer",
            onClick: () => {
              vibrar();
              salvar.mutate([antiga]);
            },
          },
        }),
    });
  }

  function alternarEntrega(v: Venda) {
    vibrar();
    if (v.status === "entregue") {
      darPop(v.id);
      const volta: Venda = { ...v, status: "pendente" };
      salvar.mutate([volta], {
        onSuccess: () =>
          toast("Voltou para pendente", {
            description: v.cliente,
            action: { label: "Refazer", onClick: () => salvar.mutate([v]) },
          }),
      });
      return;
    }
    if (!v.entreguePor && aba === "todos") {
      setPrefill(true);
      setEditando(v);
      return;
    }
    const nova: Venda =
      !v.entreguePor && aba !== "todos"
        ? { ...v, status: "entregue", entreguePor: aba }
        : { ...v, status: "entregue" };
    aplicarEntregue(nova, v);
  }

  function salvarEdicao(v: Venda) {
    setEditando(null);
    salvar.mutate([v], {
      onSuccess: () => toast.success("Entrega atualizada", { description: v.cliente }),
    });
  }

  function salvarCadastro(d: Entregador) {
    const ehNovo = folha?.novo ?? true;
    setFolha(null);
    salvarE.mutate(d, {
      onSuccess: () =>
        toast.success(ehNovo ? "Entregador cadastrado" : "Entregador atualizado", {
          description: d.nome,
        }),
      onError: () => toast.error("Não foi possível salvar o entregador."),
    });
  }

  function excluirCadastro(d: Entregador) {
    setFolha(null);
    removerE.mutate(d.id, {
      onSuccess: () => toast.success("Entregador removido", { description: d.nome }),
      onError: () => toast.error("Não foi possível excluir o entregador."),
    });
  }

  function abrirNovoEntregador() {
    vibrar(8);
    setFolha({ dados: { id: uid("ent"), nome: "", telefone: "", ativo: true }, novo: true });
  }

  function selecionarAba(valor: string) {
    setAba(valor);
    setSoSem(false);
  }

  return (
    <div className="flex flex-col gap-4 pb-16">
      {/* ---------------------------------------------------------- resumo */}
      <Cartao className="overflow-hidden p-0">
        <div className="bg-brand px-4 pb-4 pt-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold/85">
            <Bike size={14} /> Entregas de hoje
          </p>
          <div className="mt-1.5 flex items-end justify-between gap-3">
            <p className="font-display text-[26px] font-semibold leading-none text-crema">
              <NumeroAnimado valor={entregues} className="text-gold" />
              <span className="mx-1.5 text-lg font-normal text-crema/70">de</span>
              <NumeroAnimado valor={marmitas} />
              <span className="ml-1.5 text-base font-normal text-crema/80">marmitas</span>
            </p>
            <motion.span
              key={percentual}
              initial={{ scale: 0.8, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={MOLINHO_FIRME}
              className="num text-2xl font-bold text-gold"
            >
              {percentual}%
            </motion.span>
          </div>
          <div className="mt-3">
            <Barra
              altura="h-3"
              partes={[
                { valor: entregues, cor: "bg-entregue", chave: "ent" },
                { valor: restante, cor: "bg-white/25", chave: "rest" },
              ]}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-tinta-2">
            <span className="h-2.5 w-2.5 rounded-full bg-neutro ring-2 ring-neutro/30" />
            <NumeroAnimado valor={linhasFaltando} className="font-bold text-tinta" /> linhas a entregar
          </span>
          <span className="text-xs text-tinta-3">Toque na linha para editar</span>
        </div>
      </Cartao>

      {/* ------------------------------------------------- entregadores */}
      <div className="flex flex-col gap-2.5">
        <TituloSecao
          acao={
            <Botao variante="dourado" tamanho="sm" className="h-9 gap-1 px-3 text-[12.5px]" onClick={abrirNovoEntregador}>
              <Plus size={15} strokeWidth={2.6} /> Novo entregador
            </Botao>
          }
        >
          <span className="flex items-center gap-2">
            <Users size={18} className="text-brand" /> Entregadores ({entregadores.length})
          </span>
        </TituloSecao>

        {entQ.isPending ? (
          <div className="flex flex-col gap-2">
            <Esqueleto className="h-14 rounded-[18px]" />
          </div>
        ) : entregadores.length === 0 ? (
          <Cartao className="flex items-center justify-between gap-3 p-3.5">
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-tinta">Nenhum entregador cadastrado</p>
              <p className="text-[12px] text-tinta-3">Cadastre seus entregadores para atribuir as entregas.</p>
            </div>
            <Botao variante="primario" tamanho="sm" className="shrink-0" onClick={abrirNovoEntregador}>
              <Plus size={15} /> Cadastrar
            </Botao>
          </Cartao>
        ) : (
          <ul className="flex flex-col gap-2">
            {entregadores.map((e) => (
              <li key={e.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setFolha({ dados: { ...e }, novo: false })}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      setFolha({ dados: { ...e }, novo: false });
                    }
                  }}
                  className={cn(
                    "card flex items-center gap-3 p-3 transition-transform active:scale-[0.99]",
                    !e.ativo && "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full font-display text-base font-semibold",
                      e.ativo ? "bg-brand text-crema" : "bg-neutro text-neutro-ink",
                    )}
                  >
                    {iniciais(e.nome)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-semibold text-tinta">{e.nome}</p>
                      {!e.ativo && (
                        <Chip className="shrink-0 border-neutro bg-neutro/70 px-1.5 py-0 text-[10px] text-neutro-ink">
                          Inativo
                        </Chip>
                      )}
                    </div>
                    {e.telefone ? (
                      <a
                        href={telHref(e.telefone)}
                        onClick={(ev) => ev.stopPropagation()}
                        className="mt-0.5 flex w-fit items-center gap-1 truncate text-[12.5px] font-medium text-brand active:underline"
                      >
                        <Phone size={12} /> {e.telefone}
                      </a>
                    ) : (
                      <p className="mt-0.5 text-[12px] text-tinta-3">Toque para editar</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <NumeroAnimado
                      valor={entreguesPor[e.id] ?? 0}
                      className="text-lg font-bold text-entregue"
                    />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-tinta-3">entregues</p>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-tinta-3" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ------------------------------------------------------------ abas */}
      <div>
        <div className="flex gap-2 overflow-x-auto pb-1.5">
          <Aba nome="Todos" selecionada={aba === "todos" && !soSem} onClick={() => selecionarAba("todos")} />
          {ativos.map((e) => (
            <Aba
              key={e.id}
              nome={e.nome}
              badge={porEntregador[e.id] ?? 0}
              selecionada={!soSem && aba === e.id}
              onClick={() => selecionarAba(e.id)}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Botao
            variante={soSem ? "primario" : "neutro"}
            tamanho="sm"
            onClick={() => {
              vibrar();
              setSoSem((s) => !s);
            }}
          >
            <UserX size={15} /> Sem entregador
            <span className="num ml-0.5 rounded-full bg-black/10 px-1.5 text-[11px] font-bold">
              {semEntregadorLinhas}
            </span>
          </Botao>
          {soSem && (
            <span className="text-xs font-semibold text-brand">Mostrando só quem está sem entregador</span>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------- a entrega */}
      {diaQ.isError ? (
        <Cartao className="flex flex-col items-start gap-2.5 border-gold-300 bg-gold-soft p-4">
          <p className="text-[13px] font-semibold leading-snug text-preparada-ink">
            Não consegui abrir as entregas de hoje. Verifique a internet e tente de novo.
          </p>
          <Botao variante="dourado" tamanho="sm" carregando={diaQ.isFetching} onClick={() => void diaQ.refetch()}>
            <RotateCcw size={15} />
            Tentar de novo
          </Botao>
        </Cartao>
      ) : diaQ.isPending ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Esqueleto key={i} className="h-16 rounded-[18px]" />
          ))}
        </div>
      ) : ativas.length === 0 ? (
        <Cartao className="p-1">
          <Vazio
            icone={<PackageOpen size={28} />}
            titulo="Sem entregas hoje"
            descricao="Os pedidos do dia aparecem aqui."
          />
        </Cartao>
      ) : lista.length === 0 ? (
        <Cartao className="p-1">
          <Vazio
            icone={<Bike size={28} />}
            titulo="Nada nesta seleção"
            descricao="Nenhuma marmita neste filtro."
            acao={
              <Botao
                variante="neutro"
                tamanho="sm"
                onClick={() => {
                  setAba("todos");
                  setSoSem(false);
                }}
              >
                Ver todas
              </Botao>
            }
          />
        </Cartao>
      ) : (
        <ul className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {lista.map((v) => {
              const nome = v.entreguePor ? mapaNome[v.entreguePor] : undefined;
              const done = v.status === "entregue";
              const aparencia = APARENCIA[v.status];
              return (
                <motion.li
                  key={v.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
                  transition={MOLINHO}
                >
                  <motion.div
                    animate={popId === v.id ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                    transition={MOLINHO_FIRME}
                    onClick={() => {
                      setPrefill(false);
                      setEditando(v);
                    }}
                    className={cn(
                      "card flex items-center gap-3 p-3 active:bg-crema-2",
                      done && "opacity-90",
                    )}
                  >
                    <span className={cn("size-3 shrink-0 rounded-full", aparencia.ponto)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[15px] font-semibold text-tinta">{v.cliente}</p>
                        {v.qtd > 1 && (
                          <span className="num shrink-0 rounded-full bg-brand-soft px-1.5 text-[12px] font-bold text-brand">
                            ×{v.qtd}
                          </span>
                        )}
                        {v.pg && (
                          <Chip className="shrink-0 border-gold-300 bg-gold-soft px-1.5 py-0 text-[10px] text-preparada-ink">
                            PG
                          </Chip>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[13px]">
                        {nome ? (
                          <span className="text-tinta-3">{nome}</span>
                        ) : (
                          <span className="font-semibold text-gold-600">sem entregador</span>
                        )}
                      </p>
                    </div>
                    {done ? (
                      <Botao
                        variante="neutro"
                        tamanho="md"
                        className="shrink-0"
                        carregando={salvar.isPending && editando === null && !folha}
                        onClick={(e) => {
                          e.stopPropagation();
                          alternarEntrega(v);
                        }}
                      >
                        <Undo2 size={16} /> Desfazer
                      </Botao>
                    ) : (
                      <Botao
                        variante="sucesso"
                        tamanho="lg"
                        className="shrink-0"
                        carregando={salvar.isPending && editando === null && !folha}
                        onClick={(e) => {
                          e.stopPropagation();
                          alternarEntrega(v);
                        }}
                      >
                        <Check size={18} strokeWidth={2.6} /> Entregue
                      </Botao>
                    )}
                  </motion.div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {editando && (
        <EditorVenda
          key={editando.id}
          venda={editando}
          entregadores={ativos}
          statusInicial={prefill ? "entregue" : undefined}
          salvando={salvar.isPending}
          aoFechar={() => setEditando(null)}
          aoSalvar={salvarEdicao}
          aoNovoEntregador={() => {
            setEditando(null);
            abrirNovoEntregador();
          }}
        />
      )}

      {folha && (
        <EditorEntregador
          key={folha.dados.id}
          dados={folha.dados}
          novo={folha.novo}
          salvando={salvarE.isPending}
          excluindo={removerE.isPending}
          aoFechar={() => setFolha(null)}
          aoSalvar={salvarCadastro}
          aoExcluir={excluirCadastro}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- aba / tab */

function Aba({
  nome,
  badge,
  selecionada,
  onClick,
}: {
  nome: string;
  badge?: number;
  selecionada: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      layout
      onClick={onClick}
      whileTap={apertar}
      transition={MOLINHO}
      className={cn(
        "relative flex h-11 shrink-0 items-center rounded-2xl px-4 text-sm font-semibold",
        !selecionada && "border border-line bg-white text-brand",
        selecionada && "text-crema",
      )}
    >
      {selecionada && (
        <motion.span
          layoutId="aba-entrega"
          transition={MOLINHO}
          className="absolute inset-0 rounded-2xl bg-brand shadow-elevado"
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5">
        <span className="max-w-[12ch] truncate">{nome}</span>
        {badge !== undefined && badge > 0 && (
          <motion.span
            key={badge}
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={MOLINHO_FIRME}
            className={cn(
              "num rounded-full px-1.5 py-0.5 text-[11px] font-bold",
              selecionada ? "bg-gold text-brand-ink" : "bg-brand-soft text-brand",
            )}
          >
            {badge}
          </motion.span>
        )}
      </span>
    </motion.button>
  );
}

/* ------------------------------------------------- editor: venda / entrega */

function EditorVenda({
  venda,
  entregadores,
  statusInicial,
  salvando,
  aoFechar,
  aoSalvar,
  aoNovoEntregador,
}: {
  venda: Venda;
  entregadores: Entregador[];
  statusInicial?: StatusVenda;
  salvando: boolean;
  aoFechar: () => void;
  aoSalvar: (v: Venda) => void;
  aoNovoEntregador: () => void;
}) {
  const [por, setPor] = useState<string | null>(venda.entreguePor);
  const [status, setStatus] = useState<StatusVenda>(statusInicial ?? venda.status);
  const [pg, setPg] = useState(venda.pg);

  return (
    <Sheet
      aberto
      aoFechar={aoFechar}
      titulo={`Entrega · ${venda.cliente}`}
      rodape={
        <Botao
          variante="primario"
          tamanho="lg"
          larguraTotal
          carregando={salvando}
          onClick={() => {
            vibrar();
            aoSalvar({ ...venda, entreguePor: por, status, pg });
          }}
        >
          <Check size={18} /> Salvar entrega
        </Botao>
      }
    >
      <p className="pb-3 pt-1 text-sm text-tinta-2">
        <span className="num font-bold text-tinta">×{venda.qtd}</span> marmita{venda.qtd > 1 ? "s" : ""} ·{" "}
        {APARENCIA[status].rotulo}
      </p>

      <div className="flex items-center justify-between pb-2">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-tinta-3">Quem entrega</p>
        <button
          type="button"
          onClick={aoNovoEntregador}
          className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 text-[12px] font-bold text-preparada-ink active:scale-95"
        >
          <Plus size={14} strokeWidth={2.5} /> Novo entregador
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <LinhaOpcao
          rotulo="Sem entregador"
          sub="Deixa a marmita disponível"
          selecionada={por === null}
          onClick={() => setPor(null)}
          icone={<UserX size={18} />}
        />
        {entregadores.map((e) => (
          <LinhaOpcao
            key={e.id}
            rotulo={e.nome}
            sub={e.telefone || undefined}
            selecionada={por === e.id}
            onClick={() => setPor(e.id)}
            inicial={iniciais(e.nome)}
          />
        ))}
      </div>

      <p className="pb-2 pt-4 text-[13px] font-semibold uppercase tracking-wide text-tinta-3">Status</p>
      <div className="grid grid-cols-3 gap-1.5">
        {STATUS_OPCOES.map((st) => {
          const sel = status === st;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setStatus(st)}
              className={cn(
                "relative flex min-h-11 min-w-0 items-center justify-center rounded-2xl px-1.5 py-1.5 text-[12px] font-semibold leading-normal sm:text-[13px]",
                !sel && "border border-line bg-white text-tinta-2",
                sel && "text-crema",
              )}
            >
              {sel && (
                <motion.span layoutId="status-edicao" transition={MOLINHO} className="absolute inset-0 rounded-2xl bg-brand" />
              )}
              <span className="relative z-10 flex min-w-0 items-center gap-1 leading-normal">
                <span className={cn("size-2 shrink-0 rounded-full", APARENCIA[st].ponto)} />
                <span className="whitespace-nowrap leading-normal">{APARENCIA[st].curto}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="pb-2 pt-4 text-[13px] font-semibold uppercase tracking-wide text-tinta-3">Pagamento</p>
      <button
        type="button"
        onClick={() => {
          vibrar();
          setPg((p) => !p);
        }}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-2.5"
      >
        <span className="flex min-w-0 flex-col text-left">
          <span className="truncate text-[14px] font-semibold text-tinta">Pago na entrega (PG)</span>
          <span className="truncate text-xs text-tinta-3">Retirar depois</span>
        </span>
        <span
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors",
            pg ? "bg-entregue" : "bg-neutro",
          )}
        >
          <motion.span
            layout
            transition={MOLINHO_FIRME}
            className={cn("absolute top-1 size-5 rounded-full bg-white shadow", pg ? "left-6" : "left-1")}
          />
        </span>
      </button>
    </Sheet>
  );
}

function LinhaOpcao({
  rotulo,
  sub,
  selecionada,
  onClick,
  icone,
  inicial,
}: {
  rotulo: string;
  sub?: string;
  selecionada: boolean;
  onClick: () => void;
  icone?: ReactNode;
  inicial?: string;
}) {
  return (
    <motion.button
      layout
      onClick={onClick}
      whileTap={apertar}
      transition={MOLINHO}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-2xl border px-3 py-2 text-left",
        selecionada ? "border-brand bg-brand/8" : "border-line bg-white",
      )}
    >
      {inicial !== undefined ? (
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full font-display font-semibold",
            selecionada ? "bg-brand text-crema" : "bg-crema-2 text-brand",
          )}
        >
          {inicial}
        </span>
      ) : (
        icone && <span className={cn("shrink-0", selecionada ? "text-brand" : "text-tinta-3")}>{icone}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-tinta">{rotulo}</span>
        {sub && <span className="block truncate text-[13px] text-tinta-3">{sub}</span>}
      </span>
      <AnimatePresence>
        {selecionada && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={MOLINHO_FIRME}
            className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-crema"
          >
            <Check size={15} strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/* --------------------------------------- editor: cadastro de entregador */

function EditorEntregador({
  dados,
  novo,
  salvando,
  excluindo,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  dados: Entregador;
  novo: boolean;
  salvando: boolean;
  excluindo: boolean;
  aoFechar: () => void;
  aoSalvar: (e: Entregador) => void;
  aoExcluir: (e: Entregador) => void;
}) {
  const [nome, setNome] = useState(dados.nome);
  const [telefone, setTelefone] = useState(dados.telefone);
  const [ativo, setAtivo] = useState(dados.ativo);
  const [erro, setErro] = useState<string | undefined>();
  const [confirmar, setConfirmar] = useState(false);

  function salvar() {
    if (!nome.trim()) {
      setErro("Informe o nome do entregador");
      return;
    }
    aoSalvar({ id: dados.id, nome: nome.trim(), telefone: telefone.trim(), ativo });
  }

  return (
    <Sheet
      aberto
      aoFechar={aoFechar}
      titulo={novo ? "Novo entregador" : "Editar entregador"}
      rodape={
        <Botao variante="primario" tamanho="lg" larguraTotal carregando={salvando} onClick={salvar}>
          <Check size={18} /> {novo ? "Cadastrar" : "Salvar"}
        </Botao>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        <Campo
          rotulo="Nome"
          dica="Ex.: Carlos"
          value={nome}
          erro={erro}
          onChange={(e) => {
            setNome(e.target.value);
            if (erro) setErro(undefined);
          }}
        />
        <Campo
          rotulo="Telefone"
          dica="Opcional · (31) 99999-0000"
          type="tel"
          inputMode="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <span className="pl-1 text-[13px] font-semibold text-tinta-2">Situação</span>
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(
                "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 text-[13.5px] font-bold transition-colors",
                ativo ? "border-paga bg-paga text-white" : "border-line bg-white text-tinta-2",
              )}
              onClick={() => {
                vibrar();
                setAtivo(true);
              }}
            >
              <Check size={15} strokeWidth={2.6} /> Ativo
            </button>
            <button
              type="button"
              className={cn(
                "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 text-[13.5px] font-bold transition-colors",
                !ativo ? "border-cancelada bg-cancelada text-white" : "border-line bg-white text-tinta-2",
              )}
              onClick={() => {
                vibrar();
                setAtivo(false);
              }}
            >
              Inativo
            </button>
          </div>
        </div>

        {!novo && (
          <div className="mt-2 border-t border-line pt-3">
            <AnimatePresence initial={false} mode="wait">
              {confirmar ? (
                <motion.div
                  key="confirmar"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={MOLINHO}
                  className="flex flex-col gap-2"
                >
                  <p className="text-sm text-tinta-2">
                    Remover <span className="font-semibold text-tinta">{dados.nome}</span>? As entregas já
                    atribuídas a ele ficam sem entregador.
                  </p>
                  <div className="flex gap-2">
                    <Botao variante="neutro" tamanho="md" className="flex-1" onClick={() => setConfirmar(false)}>
                      Cancelar
                    </Botao>
                    <Botao
                      variante="perigo"
                      tamanho="md"
                      className="flex-1"
                      carregando={excluindo}
                      onClick={() => {
                        vibrar();
                        aoExcluir(dados);
                      }}
                    >
                      <Trash2 size={16} /> Excluir
                    </Botao>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="gatilho"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={MOLINHO}
                >
                  <Botao variante="fantasma" tamanho="md" larguraTotal onClick={() => setConfirmar(true)}>
                    <Trash2 size={16} className="text-cancelada" /> Excluir entregador
                  </Botao>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Sheet>
  );
}
