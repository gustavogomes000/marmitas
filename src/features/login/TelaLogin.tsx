import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Variants } from "motion/react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  Sparkles,
  TriangleAlert,
  Unlock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LogoCompleta, Simbolo } from "@/shared/components/Marca";
import { Botao } from "@/shared/components/ui";
import { useSessao } from "@/features/auth/sessao";
import { MOLINHO, SUAVE, subir } from "@/shared/lib/motion";
import { useReduzirMovimento, vibrar } from "@/shared/hooks/useAnimacao";
import { cn } from "@/shared/lib/cn";

const ENTRADA: Variants = {
  oculto: {},
  visivel: { transition: { staggerChildren: 0.09, delayChildren: 0.06 } },
};

const LOGO_ENTRADA: Variants = {
  oculto: { opacity: 0, y: 16, scale: 0.9, filter: "blur(8px)" },
  visivel: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { ...SUAVE, duration: 0.55 },
  },
};

function Entrada({
  delay,
  reduzido,
  children,
}: {
  delay: number;
  reduzido: boolean;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={reduzido ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SUAVE, delay: reduzido ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

function CampoFlutuante({
  rotulo,
  dica,
  valor,
  onMudar,
  icone: Icone,
  tipo = "text",
  nome,
  autoComplete,
  entradaModo,
  delay,
  reduzido,
  acao,
}: {
  rotulo: string;
  dica: string;
  valor: string;
  onMudar: (v: string) => void;
  icone: LucideIcon;
  tipo?: "email" | "password" | "text";
  nome: string;
  autoComplete: string;
  entradaModo?: "email" | "text";
  delay: number;
  reduzido: boolean;
  acao?: ReactNode;
}) {
  const [foco, setFoco] = useState(false);
  const id = useId();
  const flutua = foco || valor.length > 0;
  return (
    <Entrada delay={delay} reduzido={reduzido}>
      <motion.div
        className="relative h-[60px] rounded-[20px] border bg-white"
        initial={false}
        animate={{
          borderColor: foco ? "#fba011" : "#eaddd1",
          scale: foco ? 1.012 : 1,
          boxShadow: foco
            ? "0 14px 28px -16px rgb(251 160 17 / 0.65), 0 0 0 3px rgb(251 160 17 / 0.16), inset 0 1px 0 rgb(255 255 255 / 0.8)"
            : "0 2px 8px -4px rgb(82 16 17 / 0.2), inset 0 1px 0 rgb(255 255 255 / 0.8)",
        }}
        transition={MOLINHO}
      >
        <motion.span
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
          initial={false}
          animate={{ color: foco ? "#d98207" : "#8b7a72", scale: foco ? 1.08 : 1 }}
          transition={MOLINHO}
        >
          <Icone size={19} />
        </motion.span>
        <motion.label
          htmlFor={id}
          className="pointer-events-none absolute left-[46px] top-0 origin-left text-[15px] font-medium"
          initial={false}
          animate={{
            y: flutua ? 8 : 19,
            scale: flutua ? 0.76 : 1,
            color: flutua ? "#7c4a02" : "#8b7a72",
          }}
          transition={MOLINHO}
        >
          {rotulo}
        </motion.label>
        <input
          id={id}
          name={nome}
          type={tipo}
          value={valor}
          autoComplete={autoComplete}
          inputMode={entradaModo}
          placeholder={flutua ? dica : ""}
          onChange={(e) => onMudar(e.target.value)}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          className="h-full w-full rounded-[inherit] bg-transparent pb-1.5 pl-[46px] pr-12 pt-4 text-[16px] font-medium text-tinta outline-none placeholder:text-tinta-3/55"
        />
        {acao}
      </motion.div>
    </Entrada>
  );
}

export function TelaLogin() {
  const { sessao, entrar, carregando, erro } = useSessao();
  const reduzido = useReduzirMovimento();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [lembrar, setLembrar] = useState(true);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const tentando = useRef(false);

  useEffect(() => {
    if (sessao && tentando.current) {
      tentando.current = false;
      vibrar([12, 45, 18]);
    }
  }, [sessao]);

  if (sessao) return null;

  return (
    <div
      className="relative flex min-h-dvh flex-col justify-center overflow-x-hidden px-4 pb-[calc(1.5rem+var(--safe-bottom))] pt-[calc(1.5rem+var(--safe-top))] sm:px-6"
      style={{
        background:
          "radial-gradient(130% 85% at 50% -12%, #7a201f 0%, #521011 48%, #320609 100%)",
      }}
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 size-[420px] -translate-x-1/2 rounded-full bg-gold/12 blur-3xl" />
      {!reduzido && (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-[8%] top-[14%] size-44 rounded-full bg-gold/10 blur-3xl"
            animate={{ y: [0, -28, 0], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute right-[6%] top-[46%] size-56 rounded-full bg-brand-500/30 blur-3xl"
            animate={{ y: [0, 24, 0], opacity: [0.4, 0.75, 0.4] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute bottom-[8%] left-[18%] size-40 rounded-full bg-gold/8 blur-2xl"
            animate={{ y: [0, -20, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          />
        </>
      )}
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 -rotate-6 opacity-[0.05]">
        <Simbolo tamanho={360} />
      </div>

      <motion.div
        initial={reduzido ? "visivel" : "oculto"}
        animate="visivel"
        variants={ENTRADA}
        className="relative mx-auto flex w-full max-w-[420px] flex-col gap-5"
      >
        <motion.div variants={LOGO_ENTRADA} className="mx-auto w-full max-w-[260px] sm:max-w-[300px]">
          <div className="relative overflow-hidden">
            <LogoCompleta className="drop-shadow-[0_16px_34px_rgba(0,0,0,0.48)]" />
            {!reduzido && (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-y-[-30%] w-1/3 -rotate-[18deg]"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(253,248,243,0.34), transparent)",
                }}
                initial={{ x: "-180%" }}
                animate={{ x: "420%" }}
                transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity, repeatDelay: 3.4, delay: 1 }}
              />
            )}
          </div>
        </motion.div>

        <motion.p variants={subir} className="-mt-2 text-center text-[13.5px] font-medium leading-snug text-crema/75">
          Caixa, cozinha e entregas — a marmitaria inteira na palma da mão.
        </motion.p>

        <motion.form
          variants={subir}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            tentando.current = true;
            void entrar(email, senha, lembrar);
          }}
          className="relative flex flex-col gap-4 rounded-[28px] border border-gold/40 bg-crema p-5 sm:p-6 shadow-[0_32px_72px_-24px_rgba(0,0,0,0.7),0_12px_32px_-16px_rgba(251,160,17,0.38)]"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-10 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-gold to-transparent"
          />

          <Entrada delay={0.22} reduzido={reduzido}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-[22px] font-semibold leading-tight text-brand">
                  Entrar na cozinha
                </p>
                <p className="mt-1 text-[13px] leading-snug text-tinta-3">
                  Digite seu email e senha para abrir o sistema.
                </p>
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gold/18 text-preparada-ink">
                <Sparkles size={18} />
              </span>
            </div>
          </Entrada>

          <CampoFlutuante
            rotulo="Email"
            dica="voce@marmitaria.com"
            valor={email}
            onMudar={setEmail}
            icone={Mail}
            tipo="email"
            nome="email"
            autoComplete="username"
            entradaModo="email"
            delay={0.32}
            reduzido={reduzido}
          />

          <CampoFlutuante
            rotulo="Senha"
            dica="••••••"
            valor={senha}
            onMudar={setSenha}
            icone={Lock}
            tipo={mostrarSenha ? "text" : "password"}
            nome="senha"
            autoComplete="current-password"
            delay={0.38}
            reduzido={reduzido}
            acao={
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-2 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full text-tinta-3 transition-colors active:bg-brand/8 active:text-tinta"
              >
                {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />

          <Entrada delay={0.44} reduzido={reduzido}>
            <motion.button
              type="button"
              whileTap={reduzido ? undefined : { scale: 0.985 }}
              onClick={() => {
                vibrar(8);
                setLembrar((v) => !v);
              }}
              aria-pressed={lembrar}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-colors active:border-gold/50"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full transition-colors",
                    lembrar ? "bg-gold-soft text-preparada" : "bg-neutro/70 text-neutro-ink",
                  )}
                >
                  {lembrar ? <Lock size={16} /> : <Unlock size={16} />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-tinta">
                    Salvar meu login
                  </span>
                  <span className="block truncate text-xs text-tinta-3">
                    Entra direto da próxima vez neste celular
                  </span>
                </span>
              </span>
              <motion.span
                aria-hidden
                initial={false}
                animate={{ backgroundColor: lembrar ? "#fba011" : "#e2d5c8" }}
                transition={MOLINHO}
                className="relative h-6 w-11 shrink-0 rounded-full"
              >
                <motion.span
                  initial={false}
                  animate={{ x: lembrar ? 22 : 2 }}
                  transition={MOLINHO}
                  className="absolute left-0 top-[2px] size-5 rounded-full bg-white shadow"
                />
              </motion.span>
            </motion.button>
          </Entrada>

          <div aria-live="polite">
            <AnimatePresence>
              {erro && (
                <motion.div
                  key={erro}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto", x: [0, -6, 6, -4, 4, 0] }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ default: SUAVE, x: { duration: 0.42 } }}
                  className="overflow-hidden"
                >
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-2xl border border-gold/40 bg-gold-soft px-3.5 py-3 text-[13px] font-semibold leading-snug text-preparada-ink"
                  >
                    <TriangleAlert size={16} className="mt-px shrink-0 text-preparada" aria-hidden />
                    <span>{erro}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Entrada delay={0.5} reduzido={reduzido}>
            <Botao type="submit" variante="dourado" tamanho="lg" larguraTotal disabled={carregando}>
              {carregando ? (
                <>
                  <LoaderCircle size={19} className="animate-spin" aria-hidden />
                  Entrando…
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight size={19} aria-hidden />
                </>
              )}
            </Botao>
          </Entrada>
        </motion.form>
      </motion.div>
    </div>
  );
}
