import { useEffect, useMemo, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion, type Variants } from "motion/react";
import {
  Bike,
  CalendarDays,
  ChartColumnBig,
  ChefHat,
  ClipboardList,
  KeyRound,
  MonitorPlay,
  MoreHorizontal,
  Receipt,
  TrendingUp,
  Wallet,
  WifiOff,
} from "lucide-react";
import { Marca } from "@/shared/components/Marca";
import { cn } from "@/shared/lib/cn";
import { MOLINHO, SUAVE, apertar } from "@/shared/lib/motion";
import { useReduzirMovimento, vibrar } from "@/shared/hooks/useAnimacao";
import { useContas, useDia } from "@/shared/hooks/useDados";
import { usePWA } from "@/shared/hooks/usePWA";
import { estadoConta } from "@/domain/contas";
import { dataLonga, diaDaSemana, hojeISO } from "@/shared/lib/format";

export interface ItemNav {
  para: string;
  rotulo: string;
  icone: typeof Wallet;
}

export const ITENS_NAV: ItemNav[] = [
  { para: "/dia", rotulo: "Dia", icone: ClipboardList },
  { para: "/painel", rotulo: "Painel", icone: ChartColumnBig },
  { para: "/caixa", rotulo: "Caixa", icone: Wallet },
  { para: "/contas", rotulo: "Contas", icone: Receipt },
  { para: "/agenda", rotulo: "Agenda", icone: CalendarDays },
];

const ROTAS_SECUNDARIAS = ["/ajustes", "/cozinha", "/entregas", "/vendas", "/usuarios"];

const ATALHOS_RAPIDOS = [
  { para: "/cozinha", rotulo: "Cozinha", icone: ChefHat },
  { para: "/entregas", rotulo: "Entregas", icone: Bike },
  { para: "/vendas", rotulo: "Vendas", icone: TrendingUp },
  { para: "/usuarios", rotulo: "Acessos", icone: KeyRound },
  { para: "/ajustes", rotulo: "Opções", icone: MoreHorizontal },
] as const;

function DataHoje() {
  const hoje = hojeISO();
  return (
    <div className="hidden text-right leading-tight min-[360px]:block">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-gold">{diaDaSemana(hoje)}</p>
      <p className="mt-0.5 text-[12px] font-semibold text-crema/85">{dataLonga(hoje).split(", ")[1]}</p>
    </div>
  );
}

const rota: Variants = {
  oculto: { opacity: 0, y: 10, scale: 0.992 },
  visivel: { opacity: 1, y: 0, scale: 1, transition: SUAVE },
  saindo: { opacity: 0, y: -4, transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] } },
};

export function Layout({ children, extras }: { children: ReactNode; extras?: ReactNode }) {
  const { pathname } = useLocation();
  const reduzido = useReduzirMovimento();
  const { online } = usePWA();
  const hoje = hojeISO();

  const diaHoje = useDia(hoje);
  const contasQuery = useContas();

  const pendentesMontar = diaHoje.data?.totais.pendentes ?? 0;
  const prontasParaEntregar = diaHoje.data?.totais.preparadas ?? 0;

  const contasUrgentes = useMemo(() => {
    const lista = contasQuery.data ?? [];
    return lista.filter((c) => {
      if (c.paga) return false;
      const est = estadoConta(c, hoje);
      return est === "vencida" || est === "hoje";
    }).length;
  }, [contasQuery.data, hoje]);

  const emRotaSecundaria = ROTAS_SECUNDARIAS.some((r) => pathname.startsWith(r));

  return (
    <div className="fundo-quente relative flex min-h-dvh flex-col bg-crema">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[var(--safe-top)] bg-brand" />
      <header className="sticky top-0 z-30 bg-brand text-crema shadow-[0_12px_30px_-14px_rgba(53,7,10,0.55)]">
        <div className="mx-auto flex w-full max-w-[600px] items-center justify-between gap-2.5 px-4 pb-3.5 pt-[calc(0.8rem+var(--safe-top))]">
          <Link
            to="/dia"
            onClick={() => vibrar(6)}
            className="flex shrink-0 items-center rounded-xl py-0.5 pr-1 transition-transform active:scale-96"
            aria-label="Ir para o fluxo do dia"
          >
            <Marca compacta />
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {!online && (
              <motion.span
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/20 px-2 py-1 text-[10.5px] font-bold text-gold-300"
                title="Sem internet — salvando no celular"
              >
                <WifiOff size={12} />
                <span className="hidden min-[360px]:inline">Offline</span>
              </motion.span>
            )}

            <AtalhoTopo
              para="/cozinha"
              rotulo="Cozinha"
              icone={ChefHat}
              ativo={pathname.startsWith("/cozinha")}
              badge={pendentesMontar}
              corBadge="bg-gold text-brand-ink"
            />
            <AtalhoTopo
              para="/entregas"
              rotulo="Entregas"
              icone={Bike}
              ativo={pathname.startsWith("/entregas")}
              badge={prontasParaEntregar}
              corBadge="bg-entregue text-white"
            />

            {extras}
            <DataHoje />
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/65 to-transparent" />

        <AnimatePresence initial={false}>
          {emRotaSecundaria && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={SUAVE}
              className="overflow-hidden border-t border-crema/10 bg-brand-ink/45"
            >
              <div className="mx-auto flex w-full max-w-[600px] items-center gap-1.5 overflow-x-auto px-3 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {ATALHOS_RAPIDOS.map((item) => {
                  const ativo = pathname.startsWith(item.para);
                  const Icone = item.icone;
                  return (
                    <NavLink
                      key={item.para}
                      to={item.para}
                      onClick={() => vibrar(6)}
                      className={cn(
                        "relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors",
                        ativo ? "text-brand-ink" : "text-crema/75 hover:text-crema",
                      )}
                    >
                      {ativo && (
                        <motion.span
                          layoutId="subnav-piloto"
                          transition={MOLINHO}
                          className="absolute inset-0 rounded-full bg-gold shadow-suave"
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <Icone size={13} strokeWidth={2.3} />
                        {item.rotulo}
                      </span>
                    </NavLink>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    vibrar(8);
                    window.open("/tv", "_blank");
                  }}
                  className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-gold/30 bg-gold/12 px-2.5 py-1 text-[11px] font-semibold text-gold-300 active:bg-gold/25"
                >
                  <MonitorPlay size={12} />
                  TV
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="mx-auto w-full max-w-[600px] flex-1 px-3 pb-[calc(5.75rem+var(--safe-bottom))] pt-3 sm:px-4">
        {reduzido ? (
          children
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={pathname} variants={rota} initial="oculto" animate="visivel" exit="saindo">
              {children}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line/90 bg-white/95 shadow-[0_-10px_30px_-15px_rgba(82,16,17,0.18)] backdrop-blur-xl"
      >
        <div className="mx-auto grid w-full max-w-[600px] grid-cols-6 items-stretch gap-0.5 px-1.5 pb-[calc(0.25rem+var(--safe-bottom))] pt-1">
          {ITENS_NAV.map((item) => (
            <ItemNavAtivo
              key={item.para}
              para={item.para}
              rotulo={item.rotulo}
              icone={item.icone}
              ativo={pathname.startsWith(item.para)}
              badge={
                item.para === "/dia"
                  ? pendentesMontar
                  : item.para === "/contas"
                    ? contasUrgentes
                    : 0
              }
              corBadge={item.para === "/contas" ? "bg-cancelada text-white" : "bg-gold text-brand-ink"}
            />
          ))}
          <ItemNavAtivo
            para="/ajustes"
            rotulo="Mais"
            icone={MoreHorizontal}
            ativo={emRotaSecundaria}
          />
        </div>
      </nav>
    </div>
  );
}

function AtalhoTopo({
  para,
  rotulo,
  icone: Icone,
  ativo,
  badge,
  corBadge,
}: {
  para: string;
  rotulo: string;
  icone: typeof ChefHat;
  ativo: boolean;
  badge: number;
  corBadge: string;
}) {
  return (
      <NavLink
        to={para}
        onClick={() => vibrar(6)}
        aria-label={`${rotulo}${badge > 0 ? ` (${badge})` : ""}`}
        className={cn(
          "relative flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-bold transition-all active:scale-95",
          ativo
            ? "border-gold bg-gold text-brand-ink shadow-suave"
            : "border-crema/20 bg-crema/10 text-crema hover:bg-crema/15",
        )}
      >
        <Icone size={15} strokeWidth={2.3} />
        <span className="hidden min-[420px]:inline">{rotulo}</span>
        {badge > 0 && (
          <motion.span
            key={badge}
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={MOLINHO}
            className={cn(
              "num grid min-w-[19px] place-items-center rounded-full px-1.5 py-0.5 text-[10.5px] font-extrabold leading-none",
              ativo ? "bg-brand text-crema" : corBadge,
            )}
          >
            {badge}
          </motion.span>
        )}
      </NavLink>
  );
}

function ItemNavAtivo({
  para,
  rotulo,
  icone: Icone,
  ativo,
  badge = 0,
  corBadge = "bg-gold text-brand-ink",
}: {
  para: string;
  rotulo: string;
  icone: typeof Wallet;
  ativo: boolean;
  badge?: number;
  corBadge?: string;
}) {
  return (
    <NavLink
      to={para}
      onClick={() => vibrar(6)}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "relative flex min-w-0 flex-col items-center justify-center rounded-2xl py-1.5 text-[10.5px] font-semibold transition-colors select-none",
        ativo ? "text-brand" : "text-tinta-3 hover:text-tinta-2",
      )}
    >
      {ativo && (
        <>
          <motion.span
            layoutId="nav-fundo-ativo"
            transition={MOLINHO}
            className="pointer-events-none absolute inset-x-0.5 inset-y-0.5 rounded-2xl bg-brand/8 ring-1 ring-brand/12"
          />
          <motion.span
            layoutId="nav-barra-ativa"
            transition={MOLINHO}
            className="pointer-events-none absolute -top-1 h-[3px] w-6 rounded-full bg-brand"
          />
        </>
      )}
      <motion.span
        whileTap={apertar}
        animate={ativo ? { y: -1, scale: 1.08 } : { y: 0, scale: 1 }}
        transition={MOLINHO}
        className="relative z-10 flex flex-col items-center gap-1"
      >
        <span className="relative">
          <Icone size={20} strokeWidth={ativo ? 2.45 : 1.9} />
          {badge > 0 && (
            <motion.span
              key={badge}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={MOLINHO}
              className={cn(
                "num absolute -right-2.5 -top-1.5 grid min-w-[16px] place-items-center rounded-full px-1 py-px text-[9.5px] font-extrabold leading-none shadow-sm ring-1 ring-white",
                corBadge,
              )}
            >
              {badge > 99 ? "99+" : badge}
            </motion.span>
          )}
        </span>
        <span className={cn("max-w-full truncate leading-none tracking-tight", ativo && "font-bold")}>
          {rotulo}
        </span>
      </motion.span>
    </NavLink>
  );
}

export function useTitulo(titulo: string) {
  useEffect(() => {
    const anterior = document.title;
    document.title = `${titulo} · D'a Márcia`;
    return () => {
      document.title = anterior;
    };
  }, [titulo]);
}
