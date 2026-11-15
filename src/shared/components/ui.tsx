import { Slot } from "@radix-ui/react-slot";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, type HTMLMotionProps } from "motion/react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { ChefHat, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { MOLINHO, SUAVE, apertar } from "@/shared/lib/motion";
import { useContagem, vibrar } from "@/shared/hooks/useAnimacao";

/* ------------------------------------------------------------------- botão */

type VarianteBotao = "primario" | "dourado" | "sucesso" | "perigo" | "neutro" | "fantasma";
type TamanhoBotao = "sm" | "md" | "lg";

const VARIANTES: Record<VarianteBotao, string> = {
  primario: "bg-brand text-crema shadow-elevado active:bg-brand-700",
  dourado: "bg-gold text-brand-ink shadow-elevado active:bg-gold-600",
  sucesso: "bg-entregue text-white shadow-suave active:brightness-95",
  perigo: "bg-cancelada text-white shadow-suave active:brightness-95",
  neutro: "bg-white text-tinta border border-line shadow-suave active:border-brand/40 active:bg-crema-2/50",
  fantasma: "text-brand bg-transparent active:bg-brand/8",
};

const TAMANHOS: Record<TamanhoBotao, string> = {
  sm: "h-9 px-3 text-sm rounded-xl gap-1.5",
  md: "h-11 px-4 text-[15px] rounded-2xl gap-2",
  lg: "h-14 px-5 text-base rounded-[18px] gap-2.5",
};

export interface BotaoProps extends Omit<HTMLMotionProps<"button">, "children"> {
  asChild?: boolean;
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  larguraTotal?: boolean;
  /** Trava o botão e mostra o giro de carregamento. */
  carregando?: boolean;
  children?: ReactNode;
}

export function Botao({
  asChild,
  variante = "primario",
  tamanho = "md",
  larguraTotal,
  carregando,
  className,
  children,
  disabled,
  ...props
}: BotaoProps) {
  const classes = cn(
    "inline-flex select-none items-center justify-center font-semibold transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    "disabled:pointer-events-none disabled:opacity-45",
    TAMANHOS[tamanho],
    VARIANTES[variante],
    larguraTotal && "w-full",
    className,
  );
  const bloqueado = disabled || carregando;
  if (asChild) {
    return (
      <Slot
        className={classes}
        aria-disabled={bloqueado || undefined}
        {...(props as ComponentProps<typeof Slot>)}
      >
        {children}
      </Slot>
    );
  }
  return (
    <motion.button
      type="button"
      className={classes}
      disabled={bloqueado}
      aria-busy={carregando || undefined}
      whileTap={bloqueado ? undefined : apertar}
      transition={MOLINHO}
      {...props}
    >
      {carregando && <Giro />}
      {children}
    </motion.button>
  );
}

/* --------------------------------------------------------------- carregar */

/** Giro de 360° contínuo — o sinal de "estou trabalhando" dentro de botões. */
function Giro() {
  return (
    <motion.span
      aria-hidden
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      className="size-4 shrink-0 rounded-full border-2 border-current border-t-transparent"
    />
  );
}

/** Bloco de carregamento com respiração — usado quando não há esqueleto possível. */
export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={SUAVE}
      className="flex flex-col items-center justify-center gap-3 py-10 text-center"
    >
      <motion.span
        animate={{ scale: [1, 1.18, 1], opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand"
      >
        <ChefHat size={22} />
      </motion.span>
      <p className="text-[13px] font-semibold text-tinta-3">{texto}</p>
    </motion.div>
  );
}

/** Filete fino no topo da tela: aparece enquanto uma gravação não termina. */
export function BarraProgresso({ ativo }: { ativo: boolean }) {
  return (
    <AnimatePresence>
      {ativo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-gold/25"
          aria-hidden
        >
          <motion.span
            className="absolute inset-y-0 w-1/3 rounded-full bg-gold"
            initial={{ x: "-100%" }}
            animate={{ x: "320%" }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------- chip */

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={MOLINHO}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        className,
      )}
    >
      {children}
    </motion.span>
  );
}

/* ------------------------------------------------------------------ cartão */

export function Cartao({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("card", className)} {...props}>
      {children}
    </div>
  );
}

export function TituloSecao({
  children,
  acao,
  className,
}: {
  children: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-1", className)}>
      <h2 className="font-display text-[17px] font-semibold text-brand">{children}</h2>
      {acao}
    </div>
  );
}

/* ------------------------------------------------------------------ campos */

export interface CampoProps extends ComponentProps<"input"> {
  rotulo: string;
  dica?: string;
  erro?: string;
  prefixo?: string;
  inputClassName?: string;
  acaoDireita?: ReactNode;
}

export function Campo({ rotulo, dica, erro, prefixo, acaoDireita, className, inputClassName, ...props }: CampoProps) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="pl-1 text-[13px] font-semibold text-tinta-2">
        {rotulo}
      </label>
      <div className="relative">
        {prefixo && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-tinta-3">
            {prefixo}
          </span>
        )}
        <input
          id={id}
          placeholder={dica}
          className={cn(
            "h-12 w-full rounded-2xl border border-line bg-white px-4 text-[16px] shadow-dentro",
            "placeholder:text-tinta-3/70 focus:border-brand focus:ring-4 focus:ring-brand/10 focus:outline-none",
            "transition-[border-color,box-shadow]",
            prefixo && "pl-11",
            acaoDireita && "pr-10",
            erro && "border-cancelada ring-4 ring-cancelada/10",
            inputClassName,
          )}
          {...props}
        />
        {acaoDireita && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {acaoDireita}
          </div>
        )}
      </div>
      <AnimatePresence>
        {erro && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="pl-1 text-xs font-semibold text-cancelada"
          >
            {erro}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AreaTexto({
  rotulo,
  dica,
  className,
  ...props
}: { rotulo: string; dica?: string } & ComponentProps<"textarea">) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="pl-1 text-[13px] font-semibold text-tinta-2">
        {rotulo}
      </label>
      <textarea
        id={id}
        placeholder={dica}
        className="min-h-28 w-full resize-none rounded-2xl border border-line bg-white p-4 text-[16px] leading-relaxed shadow-dentro placeholder:text-tinta-3/70 focus:border-brand focus:ring-4 focus:ring-brand/10 focus:outline-none"
        {...props}
      />
    </div>
  );
}

/* --------------------------------------------------------------- teclado */

export function TecladoNumero({
  valor,
  aoMudar,
  decimais,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  decimais?: boolean;
}) {
  const teclas = decimais
    ? ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "apagar"]
    : ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "apagar"];
  return (
    <div className="grid grid-cols-3 gap-2 p-2.5">
      {teclas.map((t, i) =>
        t === "" ? (
          <span key={i} />
        ) : (
          <Botao
            key={i}
            variante="neutro"
            tamanho="lg"
            aria-label={t === "apagar" ? "Apagar" : t}
            onClick={() => {
              vibrar(6);
              aoMudar(t === "apagar" ? valor.slice(0, -1) : valor + t);
            }}
            className="num text-xl font-bold"
          >
            {t === "apagar" ? "⌫" : t}
          </Botao>
        ),
      )}
    </div>
  );
}

/* -------------------------------------------------------------- progresso */

export function Barra({
  partes,
  altura = "h-2.5",
}: {
  partes: { valor: number; cor: string; chave?: string }[];
  altura?: string;
}) {
  const total = partes.reduce((s, p) => s + p.valor, 0) || 1;
  return (
    <div className={cn("flex w-full overflow-hidden rounded-full bg-crema-2", altura)}>
      {partes.map((p, i) => (
        <motion.div
          key={p.chave ?? i}
          className={cn("h-full", p.cor)}
          initial={{ width: 0 }}
          animate={{ width: `${(p.valor / total) * 100}%` }}
          transition={{ ...SUAVE, delay: i * 0.05 }}
        />
      ))}
    </div>
  );
}

export function NumeroAnimado({
  valor,
  formatar,
  className,
}: {
  valor: number;
  formatar?: (n: number) => string;
  className?: string;
}) {
  const mostrado = useContagem(valor);
  return <span className={cn("num", className)}>{formatar ? formatar(mostrado) : Math.round(mostrado)}</span>;
}

/* ------------------------------------------------------------------- sheet */

export function Sheet({
  aberto,
  aoFechar,
  titulo,
  children,
  rodape,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <Dialog.Root open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="camada fixed inset-0 z-50 bg-brand-ink/50 backdrop-blur-[3px]" />
        <Dialog.Content className="folha fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-[580px] flex-col rounded-t-[28px] border-t border-gold/25 bg-crema shadow-elevado outline-none">
          <header className="relative flex items-center justify-between border-b border-line/60 px-5 pb-3 pt-5">
            <span className="absolute left-1/2 top-2 h-1.5 w-11 -translate-x-1/2 rounded-full bg-line" />
            <Dialog.Title className="font-display text-[19px] font-semibold text-brand">{titulo}</Dialog.Title>
            <Dialog.Close asChild>
              <Botao variante="fantasma" tamanho="sm" aria-label="Fechar" className="size-9 rounded-full p-0">
                <X size={19} />
              </Botao>
            </Dialog.Close>
          </header>
          <div className="overflow-y-auto overscroll-contain px-5 pb-4 pt-3">{children}</div>
          {rodape && (
            <footer className="border-t border-line bg-crema/95 px-5 py-3 pb-[calc(0.75rem+var(--safe-bottom))] backdrop-blur-sm">
              {rodape}
            </footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ------------------------------------------------------------------- vazio */

export function Vazio({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone: ReactNode;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={MOLINHO}
      className="flex flex-col items-center gap-3 px-6 py-11 text-center"
    >
      <div className="grid size-16 place-items-center rounded-full bg-brand-soft text-brand shadow-suave">{icone}</div>
      <p className="font-display text-lg font-semibold text-brand">{titulo}</p>
      {descricao && <p className="max-w-[34ch] text-sm leading-relaxed text-tinta-2">{descricao}</p>}
      {acao}
    </motion.div>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cn("esqueleto rounded-2xl", className)} />;
}
