import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Bike, Check, ChefHat, ChevronDown, Flame, Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { StatusVenda, Venda } from "@/domain/types";
import { nomeParaExibir } from "@/domain/parser";
import { calcularTotais, faltandoMontar } from "@/domain/totais";
import { APARENCIA, ORDEM_STATUS, estaMontada, proximoStatus } from "@/shared/lib/status";
import {
  AreaTexto, Barra, Botao, Campo, Cartao, Chip, NumeroAnimado, Sheet, TituloSecao, Vazio,
} from "@/shared/components/ui";
import { hojeISO, normalizar } from "@/shared/lib/format";
import { MOLINHO, MOLINHO_FIRME, SUAVE, apertar, itemLista, listaStagger } from "@/shared/lib/motion";
import { vibrar } from "@/shared/hooks/useAnimacao";
import { useDia, useEntregadores, useRemoverVenda, useSalvarVendas } from "@/shared/hooks/useDados";
import { cn } from "@/shared/lib/cn";

type FiltroStatus = "todas" | "pendente" | "preparada" | "entregue";

const FILTROS: { valor: FiltroStatus; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "pendente", rotulo: "Pendentes" },
  { valor: "preparada", rotulo: "Preparadas" },
  { valor: "entregue", rotulo: "Entregues" },
];

/** A cozinha lê o dia de cima para baixo: o que falta primeiro. */
const RANK: Record<StatusVenda, number> = { pendente: 0, preparada: 1, entregue: 2, cancelada: 3 };

const FUNDO_LINHA: Record<StatusVenda, string> = {
  pendente: "border-line bg-white",
  preparada: "border-gold-300 bg-gold-soft/70",
  entregue: "border-entregue/30 bg-entregue/[0.06]",
  cancelada: "border-cancelada/30 bg-cancelada/[0.05]",
};

export function TelaCozinha() {
  const hoje = hojeISO();
  const consulta = useDia(hoje);
  const prepararTudo = useSalvarVendas(hoje);

  const [filtro, setFiltro] = useState<FiltroStatus>("todas");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Venda | null>(null);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [edicao, setEdicao] = useState(0);

  const resumo = consulta.data;
  const vendas = useMemo(() => resumo?.vendas ?? [], [resumo]);
  const totais = useMemo(
    () => calcularTotais(vendas, resumo?.dia.precoMarmita ?? 0),
    [vendas, resumo?.dia.precoMarmita],
  );
  const montadas = useMemo(
    () => vendas.reduce((t, v) => (estaMontada(v.status) ? t + v.qtd : t), 0),
    [vendas],
  );
  const faltam = faltandoMontar(vendas);

  const contagens = useMemo(
    () => ({
      todas: vendas.length,
      pendente: vendas.filter((v) => v.status === "pendente").length,
      preparada: vendas.filter((v) => v.status === "preparada").length,
      entregue: vendas.filter((v) => v.status === "entregue").length,
    }),
    [vendas],
  );

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return vendas
      .filter((v) => (filtro === "todas" ? true : v.status === filtro))
      .filter((v) => (termo ? normalizar(v.cliente).includes(termo) : true))
      .sort(
        (a, b) =>
          RANK[a.status] - RANK[b.status] ||
          a.cliente.localeCompare(b.cliente, "pt-BR", { sensitivity: "base" }),
      );
  }, [vendas, filtro, busca]);

  function abrirEdicao(venda: Venda) {
    setEditando(venda);
    setEdicao((n) => n + 1);
    setSheetAberto(true);
  }

  function prepararPendentes() {
    const pendentes = vendas.filter((v) => v.status === "pendente");
    if (!pendentes.length) return;
    const anterior: Venda[] = pendentes.map((v) => ({ ...v }));
    const agora: Venda[] = pendentes.map((v) => ({ ...v, status: "preparada" }));
    prepararTudo.mutate(agora, {
      onSuccess: () => {
        vibrar([14, 40, 14]);
        toast.success(`${agora.length} linha${agora.length > 1 ? "s" : ""} preparada${agora.length > 1 ? "s" : ""}`, {
          description: "Tudo o que estava pendente virou pronto.",
          action: { label: "Desfazer", onClick: () => prepararTudo.mutate(anterior) },
          duration: 6000,
        });
      },
    });
  }

  if (consulta.isError) {
    return (
      <Cartao className="flex flex-col items-start gap-2.5 border-gold-300 bg-gold-soft p-4">
        <p className="text-[13px] font-semibold leading-snug text-preparada-ink">
          Não consegui abrir a produção de hoje. Verifique a internet e tente de novo.
        </p>
        <Botao variante="dourado" tamanho="sm" carregando={consulta.isFetching} onClick={() => void consulta.refetch()}>
          <RotateCcw size={15} />
          Tentar de novo
        </Botao>
      </Cartao>
    );
  }

  if (!resumo) {
    return (
      <div className="flex flex-col gap-3">
        <div className="esqueleto h-[132px] rounded-[20px]" />
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="esqueleto h-14 rounded-[18px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Cartao className="overflow-hidden p-0">
        <div className="flex items-center gap-2.5 border-b border-brand-ink/20 bg-brand px-4 py-2.5 text-crema">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold text-brand">
            <ChefHat size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] font-semibold leading-tight">Produção de hoje</p>
            <p className="truncate text-[11px] text-crema/70">Toque em um nome para mudar o estado dele</p>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-line">
          <Medidor rotulo="Total" valor={totais.marmitas} cor="text-brand" />
          <Medidor rotulo="Montadas" valor={montadas} cor="text-entregue-ink" />
          <Medidor rotulo="Faltam" valor={faltam} cor="text-preparada-ink" />
        </div>

        <div className="px-4 pb-3.5 pt-1">
          <Barra
            partes={[
              { valor: totais.entregues, cor: APARENCIA.entregue.barra, chave: "entregue" },
              { valor: totais.preparadas, cor: APARENCIA.preparada.barra, chave: "preparada" },
              { valor: totais.pendentes, cor: APARENCIA.pendente.barra, chave: "pendente" },
            ]}
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Legenda cor={APARENCIA.entregue.barra} rotulo="Entregues" valor={totais.entregues} />
            <Legenda cor={APARENCIA.preparada.barra} rotulo="Prontas" valor={totais.preparadas} />
            <Legenda cor={APARENCIA.pendente.barra} rotulo="Pendentes" valor={totais.pendentes} />
          </div>
        </div>
      </Cartao>

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-0.5">
        {FILTROS.map((f) => {
          const ativo = filtro === f.valor;
          return (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              aria-pressed={ativo}
              className={cn(
                "relative shrink-0 overflow-hidden rounded-full px-4 py-2.5 text-[14px] font-semibold transition-colors",
                ativo ? "text-crema" : "border border-line bg-white text-tinta-2",
              )}
            >
              {ativo && (
                <motion.span
                  layoutId="piloto-cozinha-filtro"
                  transition={MOLINHO}
                  className="absolute inset-0 rounded-full bg-brand"
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {f.rotulo}
                <span
                  className={cn(
                    "num rounded-full px-1.5 text-[11px] font-bold",
                    ativo ? "bg-crema/25 text-crema" : "bg-crema-2 text-tinta-3",
                  )}
                >
                  {contagens[f.valor]}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <Campo
        rotulo="Buscar cliente"
        dica="nome, mesmo sem acento"
        inputMode="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {contagens.pendente > 0 && (
        <Botao variante="dourado" tamanho="lg" larguraTotal carregando={prepararTudo.isPending} onClick={prepararPendentes}>
          <Flame size={18} />
          Preparar todas as pendentes ({contagens.pendente})
        </Botao>
      )}

      <TituloSecao acao={<span className="num text-xs text-tinta-3">{visiveis.length} na tela</span>}>
        Ordem de produção
      </TituloSecao>

      {vendas.length === 0 ? (
        <Vazio
          icone={<ChefHat size={26} />}
          titulo="Nada para cozinhar hoje"
          descricao="Assim que lançarem os pedidos no dia, cada marmita aparece aqui como uma linha grande — um toque muda o estado."
        />
      ) : visiveis.length === 0 ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card px-4 py-8 text-center text-[15px] font-semibold text-tinta-2"
        >
          Nenhuma linha com esse filtro. {busca ? `Nada com “${busca}”.` : ""}
        </motion.p>
      ) : (
        <motion.ul variants={listaStagger} initial="oculto" animate="visivel" className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {visiveis.map((venda) => (
              <LinhaCozinha key={venda.id} venda={venda} hoje={hoje} aoAbrir={() => abrirEdicao(venda)} />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <Sheet
        aberto={sheetAberto}
        aoFechar={() => setSheetAberto(false)}
        titulo={editando ? nomeParaExibir(editando.cliente) : "Linha"}
      >
        {editando && (
          <PainelLinha
            key={edicao}
            venda={editando}
            hoje={hoje}
            aoFechar={() => setSheetAberto(false)}
          />
        )}
      </Sheet>
    </div>
  );
}

function Medidor({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-1 py-3.5">
      <NumeroAnimado valor={valor} className={cn("text-[clamp(22px,7vw,30px)] font-bold leading-none", cor)} />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tinta-3">{rotulo}</span>
    </div>
  );
}

function Legenda({ cor, rotulo, valor }: { cor: string; rotulo: string; valor: number }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold text-tinta-2">
      <span className={cn("size-2.5 shrink-0 rounded-full", cor)} />
      <span>{rotulo}</span>
      <NumeroAnimado valor={valor} className="font-bold text-tinta" />
    </span>
  );
}

function LinhaCozinha({ venda, hoje, aoAbrir }: { venda: Venda; hoje: string; aoAbrir: () => void }) {
  const salvar = useSalvarVendas(hoje);
  const [status, setStatus] = useState<StatusVenda>(venda.status);
  const [flash, setFlash] = useState<{ cor: StatusVenda; id: number } | null>(null);

  useEffect(() => {
    setStatus(venda.status);
  }, [venda.status]);

  function avancar() {
    const proximo = proximoStatus(status);
    setStatus(proximo);
    setFlash({ cor: proximo, id: Date.now() });
    vibrar(12);
    salvar.mutate([{ ...venda, status: proximo }]);
  }

  const a = APARENCIA[status];

  return (
    <motion.li
      variants={itemLista}
      exit="saindo"
      layout
      transition={MOLINHO}
      className="card relative overflow-hidden rounded-[18px]"
    >
      <AnimatePresence>
        {flash && (
          <motion.span
            key={flash.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.28 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            onAnimationComplete={() => setFlash(null)}
            className={cn("pointer-events-none absolute inset-0", APARENCIA[flash.cor].barra)}
          />
        )}
      </AnimatePresence>

      <div
        role="button"
        tabIndex={0}
        aria-label={`${nomeParaExibir(venda.cliente)} — ${a.rotulo}. Tocar para mudar o estado.`}
        onClick={avancar}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            avancar();
          }
        }}
        className={cn(
          "relative flex min-h-[56px] w-full cursor-pointer select-none items-center gap-3 pl-3.5 pr-1.5 text-left outline-none",
          FUNDO_LINHA[status],
        )}
      >
        <motion.span
          key={status}
          initial={{ scale: 0.4, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={MOLINHO_FIRME}
          className={cn("size-4 shrink-0 rounded-full shadow-dentro", a.ponto)}
        />

        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-[17px] font-semibold leading-tight text-tinta">
            {nomeParaExibir(venda.cliente)}
          </span>
          {venda.qtd > 1 && (
            <span className="num shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[12px] font-bold leading-none text-brand">
              ×{venda.qtd}
            </span>
          )}
          {venda.pg && (
            <Chip className="shrink-0 border-transparent bg-gold px-1.5 py-0 text-[10px] font-bold text-brand-ink">
              PG
            </Chip>
          )}
        </span>

        <span className="grid w-[76px] shrink-0 justify-end">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={status}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={SUAVE}
              className={cn("block truncate text-right text-[13px] font-bold", a.texto)}
            >
              {a.rotulo}
            </motion.span>
          </AnimatePresence>
        </span>

        <motion.button
          whileTap={apertar}
          onClick={(e) => {
            e.stopPropagation();
            aoAbrir();
          }}
          aria-label={`Mais opções de ${nomeParaExibir(venda.cliente)}`}
          className="grid size-9 shrink-0 place-items-center rounded-xl text-tinta-3 active:bg-brand/10 active:text-brand"
        >
          <ChevronDown size={18} />
        </motion.button>
      </div>
    </motion.li>
  );
}

function PainelLinha({ venda, hoje, aoFechar }: { venda: Venda; hoje: string; aoFechar: () => void }) {
  const entregadores = useEntregadores();
  const salvar = useSalvarVendas(hoje);
  const remover = useRemoverVenda(hoje);
  const [rascunho, setRascunho] = useState<Venda>(venda);

  const ativos = useMemo(
    () => (entregadores.data ?? []).filter((e) => e.ativo),
    [entregadores.data],
  );

  const mudarQtd = (delta: number) =>
    setRascunho((r) => ({ ...r, qtd: Math.min(99, Math.max(1, r.qtd + delta)) }));

  function guardar() {
    salvar.mutate([rascunho], {
      onSuccess: () => {
        vibrar(12);
        toast.success("Linha ajustada", { description: nomeParaExibir(rascunho.cliente) });
        aoFechar();
      },
    });
  }

  function apagar() {
    remover.mutate(venda.id, {
      onSuccess: () => {
        toast("Linha removida da produção", {
          action: { label: "Desfazer", onClick: () => salvar.mutate([venda]) },
          duration: 6000,
        });
        aoFechar();
      },
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-2">
      <div>
        <TituloSecao>Quantidade</TituloSecao>
        <div className="mt-2 flex items-center gap-3">
          <Botao variante="neutro" tamanho="lg" onClick={() => mudarQtd(-1)} aria-label="Diminuir">
            <Minus size={20} />
          </Botao>
          <span className="num flex-1 text-center text-[34px] font-bold leading-none text-brand">{rascunho.qtd}</span>
          <Botao variante="neutro" tamanho="lg" onClick={() => mudarQtd(1)} aria-label="Aumentar">
            <Plus size={20} />
          </Botao>
        </div>
      </div>

      <div>
        <TituloSecao>Status</TituloSecao>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {ORDEM_STATUS.map((st) => {
            const atual = rascunho.status === st;
            return (
              <Botao
                key={st}
                variante="neutro"
                tamanho="md"
                onClick={() => setRascunho((r) => ({ ...r, status: st }))}
                className={cn(
                  "gap-1.5 px-2.5 text-[12.5px] sm:text-[13.5px]",
                  atual
                    ? cn(
                        APARENCIA[st].barra,
                        "border-transparent ring-2 ring-brand/40",
                        st === "pendente" ? "text-neutro-ink" : "text-white",
                      )
                    : "text-tinta-2",
                )}
              >
                {atual && <Check size={15} />}
                <span className="truncate">{APARENCIA[st].rotulo}</span>
              </Botao>
            );
          })}
        </div>
      </div>

      <div>
        <TituloSecao>Entregador</TituloSecao>
        <div className="mt-2 flex flex-wrap gap-2">
          <Botao
            variante={rascunho.entreguePor === null ? "primario" : "neutro"}
            tamanho="sm"
            onClick={() => setRascunho((r) => ({ ...r, entreguePor: null }))}
          >
            Ninguém
          </Botao>
          {ativos.map((e) => (
            <Botao
              key={e.id}
              variante={rascunho.entreguePor === e.id ? "dourado" : "neutro"}
              tamanho="sm"
              onClick={() => setRascunho((r) => ({ ...r, entreguePor: e.id }))}
            >
              <Bike size={14} />
              {e.nome}
            </Botao>
          ))}
        </div>
      </div>

      <Botao
        variante={rascunho.pg ? "dourado" : "neutro"}
        tamanho="lg"
        larguraTotal
        onClick={() => setRascunho((r) => ({ ...r, pg: !r.pg }))}
        className="justify-between"
      >
        <span className="font-semibold">Já pagou (PG)</span>
        <span
          className={cn(
            "grid size-7 place-items-center rounded-full",
            rascunho.pg ? "bg-brand text-crema" : "bg-crema-2 text-tinta-3",
          )}
        >
          {rascunho.pg && <Check size={16} />}
        </span>
      </Botao>

      <AreaTexto
        rotulo="Observação da cozinha"
        dica="ex.: sem cebola, capricha na salada"
        value={rascunho.obs}
        onChange={(e) => setRascunho((r) => ({ ...r, obs: e.target.value }))}
      />

      <div className="flex gap-2 border-t border-line pt-3">
        <Botao variante="perigo" tamanho="lg" carregando={remover.isPending} onClick={apagar}>
          <Trash2 size={17} />
          Excluir
        </Botao>
        <Botao variante="primario" tamanho="lg" className="flex-1" carregando={salvar.isPending} onClick={guardar}>
          <Check size={18} />
          Salvar
        </Botao>
      </div>
    </div>
  );
}
