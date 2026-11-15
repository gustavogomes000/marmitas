import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bike,
  ChefHat,
  Crown,
  ChevronRight,
  Check,
  KeyRound,
  Plus,
  ShieldExclamationPoint,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import type { Papel, Usuario } from "@/domain/types";
import { ehAdm, useSessao } from "@/features/auth/sessao";
import { useRemoverUsuario, useSalvarUsuario, useUsuarios } from "@/shared/hooks/useDados";
import { vibrar } from "@/shared/hooks/useAnimacao";
import {
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
import { useTitulo } from "@/app/Layout";
import { dataCurta, hojeISO, hora, primeiroNome } from "@/shared/lib/format";
import { uid } from "@/shared/lib/storage";
import { MOLINHO, MOLINHO_FIRME, apertar, crescer, itemLista, listaStagger } from "@/shared/lib/motion";
import { cn } from "@/shared/lib/cn";

interface AparenciaPapel {
  rotulo: string;
  icone: typeof Users;
  avatar: string;
  chip: string;
  visto: string;
  ordem: number;
}

const PAPEIS: Record<Papel, AparenciaPapel> = {
  adm: {
    rotulo: "Admin",
    icone: Crown,
    avatar: "bg-brand text-crema",
    chip: "border-brand/25 bg-brand-soft text-brand",
    visto: "Vê e mexe em tudo: dia, caixa, vendas, entregadores e estes acessos.",
    ordem: 0,
  },
  cozinha: {
    rotulo: "Cozinha",
    icone: ChefHat,
    avatar: "bg-gold text-brand-ink",
    chip: "border-gold-300 bg-gold-soft text-preparada-ink",
    visto: "Abre só a tela da cozinha para marcar as marmitas como prontas.",
    ordem: 1,
  },
  entregador: {
    rotulo: "Entregador",
    icone: Bike,
    avatar: "bg-entregue text-white",
    chip: "border-entregue/30 bg-entregue/12 text-entregue-ink",
    visto: "Abre só a lista de entregas do dia para marcar o que já chegou.",
    ordem: 2,
  },
};

const ORDEM_PAPEIS: Papel[] = ["adm", "cozinha", "entregador"];

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1] ?? "") : "";
  const letras = primeira.slice(0, 1) + ultima.slice(0, 1);
  return letras.toUpperCase() || "?";
}

function textoUltimoAcesso(valor: string | null): string {
  if (!valor) return "Nunca entrou";
  const dia = valor.slice(0, 10);
  const horario = hora(valor);
  if (dia === hojeISO()) return `Entrou hoje às ${horario}`;
  return `Entrou em ${dataCurta(dia)} às ${horario}`;
}

export function TelaUsuarios() {
  const papel = useSessao((s) => s.sessao?.papel);
  useTitulo("Acessos");

  if (!ehAdm(papel)) return <SemPermissao />;
  return <PainelAcessos />;
}

function SemPermissao() {
  const navigate = useNavigate();
  return (
    <Vazio
      icone={<ShieldExclamationPoint size={26} />}
      titulo="Só a administradora gerencia acessos"
      descricao="Esta tela decide quem entra no app e o que cada pessoa vê. Peça para a Márcia liberar por aqui."
      acao={
        <Botao variante="neutro" className="mt-2" onClick={() => navigate("/dia")}>
          <ArrowLeft size={17} />
          Voltar
        </Botao>
      }
    />
  );
}

interface FormUsuario {
  nome: string;
  email: string;
  papel: Papel;
}

function PainelAcessos() {
  const usuarios = useUsuarios();
  const salvar = useSalvarUsuario();
  const remover = useRemoverUsuario();
  const meuId = useSessao((s) => s.sessao?.usuarioId);

  const [alvo, setAlvo] = useState<Usuario | null>(null);
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState<FormUsuario>({ nome: "", email: "", papel: "cozinha" });
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);

  const lista = [...(usuarios.data ?? [])].sort(
    (a, b) => PAPEIS[a.papel].ordem - PAPEIS[b.papel].ordem || a.nome.localeCompare(b.nome, "pt-BR"),
  );
  const ativos = lista.filter((u) => u.ativo).length;

  function abrirNovo() {
    setNovo(true);
    setAlvo(null);
    setForm({ nome: "", email: "", papel: "cozinha" });
    setConfirmarRemocao(false);
  }

  function abrirEdicao(usuario: Usuario) {
    setNovo(false);
    setAlvo(usuario);
    setForm({ nome: usuario.nome, email: usuario.email, papel: usuario.papel });
    setConfirmarRemocao(false);
  }

  function fechar() {
    setAlvo(null);
    setNovo(false);
    setConfirmarRemocao(false);
  }

  function alternarAtivo(usuario: Usuario) {
    if (usuario.id === meuId) {
      vibrar([8, 60, 8]);
      toast.error("Este é o seu próprio acesso", {
        description: "Desativar o seu acesso ia te deixar fora do app.",
      });
      return;
    }
    const proximo: Usuario = { ...usuario, ativo: !usuario.ativo };
    vibrar(usuario.ativo ? [10, 45, 10] : 14);
    salvar.mutate(proximo, {
      onSuccess: () => {
        const quem = primeiroNome(usuario.nome) || usuario.nome;
        toast.success(usuario.ativo ? `Acesso de ${quem} desligado` : `${quem} voltou a entrar`, {
          description: usuario.ativo
            ? "Quem tentar entrar vê o aviso de acesso desativado."
            : "Já pode abrir o app de novo, no papel atual.",
          action: { label: "Desfazer", onClick: () => salvar.mutate(usuario) },
          duration: 6000,
        });
      },
      onError: () => toast.error("Não deu para salvar", { description: "Confira a internet e toque de novo." }),
    });
  }

  const nomeValido = form.nome.trim().length >= 2;
  const emailValido = form.email.includes("@") && form.email.includes(".");
  const formularioValido = nomeValido && emailValido;

  function salvarFormulario() {
    if (!formularioValido) return;
    const base: FormUsuario = { nome: form.nome.trim(), email: form.email.trim(), papel: form.papel };
    const usuario: Usuario = alvo
      ? { ...alvo, ...base }
      : {
          id: uid("usr"),
          ...base,
          ativo: true,
          criadoEm: new Date().toISOString(),
          ultimoAcesso: null,
        };

    salvar.mutate(usuario, {
      onSuccess: () => {
        vibrar(12);
        toast.success(alvo ? "Acesso atualizado" : "Acesso criado", {
          description: alvo
            ? `${primeiroNome(usuario.nome)} já vê a tela do papel ${PAPEIS[usuario.papel].rotulo}.`
            : `Peça para ${primeiroNome(usuario.nome)} entrar com ${usuario.email}.`,
        });
        fechar();
      },
      onError: () => toast.error("Não deu para salvar", { description: "Tente de novo em instantes." }),
    });
  }

  function removerAcesso() {
    if (!alvo) return;
    if (alvo.id === meuId) {
      toast.error("Você não pode remover o próprio acesso");
      return;
    }
    const quem = primeiroNome(alvo.nome) || alvo.nome;
    remover.mutate(alvo.id, {
      onSuccess: () => {
        vibrar([14, 40, 14]);
        toast.success(`Acesso de ${quem} removido`, {
          description: "O histórico do dia e do caixa continua salvo.",
        });
        fechar();
      },
      onError: () => toast.error("Não deu para remover", { description: "Tente de novo em instantes." }),
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-16">
      <Cartao className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-3">Entrando agora</p>
            <p className="mt-1 flex items-baseline gap-2">
              <NumeroAnimado
                valor={ativos}
                className="font-display text-3xl font-semibold text-brand"
              />
              <span className="num text-[13px] text-tinta-2">de {lista.length} pessoa(s)</span>
            </p>
          </div>
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Users size={22} />
          </span>
        </div>
        <p className="mt-3 border-t border-line pt-3 text-[13px] leading-relaxed text-tinta-2">
          O acesso é por papel: <span className="font-semibold text-brand">Admin</span> manda em tudo,{" "}
          <span className="font-semibold text-preparada-ink">Cozinha</span> só marca o que está pronto e{" "}
          <span className="font-semibold text-entregue-ink">Entregador</span> só vê a rota do dia. O botão desliga
          na hora, sem apagar nada do histórico.
        </p>
      </Cartao>

      <TituloSecao>Quem entra no app</TituloSecao>

      {usuarios.isPending && (
        <div className="flex flex-col gap-2.5">
          <Esqueleto className="h-24" />
          <Esqueleto className="h-24" />
          <Esqueleto className="h-24" />
        </div>
      )}

      {usuarios.isError && (
        <Vazio
          icone={<KeyRound size={24} />}
          titulo="Não carregou a lista"
          descricao="Pode ser a internet do celular."
          acao={
            <Botao variante="neutro" onClick={() => void usuarios.refetch()}>
              Tentar de novo
            </Botao>
          }
        />
      )}

      {!usuarios.isPending && !usuarios.isError && lista.length === 0 && (
        <Vazio
          icone={<Users size={26} />}
          titulo="Ninguém com acesso ainda"
          descricao="Crie o primeiro acesso para a cozinha e para quem entrega as marmitas."
          acao={
            <Botao variante="dourado" onClick={abrirNovo}>
              <Plus size={18} />
              Novo acesso
            </Botao>
          }
        />
      )}

      {lista.length > 0 && (
        <motion.ul
          variants={listaStagger}
          initial="oculto"
          animate="visivel"
          className="flex flex-col gap-2.5"
        >
          <AnimatePresence initial={false}>
            {lista.map((usuario) => (
              <LinhaUsuario
                key={usuario.id}
                usuario={usuario}
                souEu={usuario.id === meuId}
                aoAbrir={abrirEdicao}
                aoAlternar={alternarAtivo}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+var(--safe-bottom))] z-20">
        <div className="mx-auto flex w-full max-w-[560px] justify-end px-4">
          <Botao variante="dourado" tamanho="lg" className="pointer-events-auto shadow-elevado" onClick={abrirNovo}>
            <Plus size={19} />
            Novo acesso
          </Botao>
        </div>
      </div>

      <Sheet
        aberto={Boolean(alvo) || novo}
        aoFechar={fechar}
        titulo={novo ? "Novo acesso" : `Editar ${alvo?.nome ?? "acesso"}`}
        rodape={
          <Botao
            variante="dourado"
            tamanho="lg"
            larguraTotal
            disabled={!formularioValido || salvar.isPending}
            onClick={salvarFormulario}
          >
            <Check size={19} />
            {salvar.isPending ? "Salvando..." : novo ? "Criar acesso" : "Salvar mudanças"}
          </Botao>
        }
      >
        <div className="flex flex-col gap-4 pb-2 pt-1">
          <Campo
            rotulo="Nome"
            dica="Ex.: Juliana (cozinha)"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            erro={!nomeValido && form.nome.length > 0 ? "Escreva pelo menos 2 letras" : undefined}
            autoComplete="off"
          />
          <Campo
            rotulo="Email"
            dica="nome@marmitaria.com"
            type="email"
            inputMode="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            erro={form.email.length > 3 && !emailValido ? "Email incompleto, falta @ ou ." : undefined}
            autoComplete="off"
          />

          <div className="flex flex-col gap-2">
            <p className="pl-1 text-[13px] font-semibold text-tinta-2">Papel — define a tela que a pessoa abre</p>
            {ORDEM_PAPEIS.map((papel) => (
              <BotaoPapel
                key={papel}
                papel={papel}
                ativo={form.papel === papel}
                aoEscolher={(escolhido) => setForm((f) => ({ ...f, papel: escolhido }))}
              />
            ))}
          </div>

          {alvo && !novo && (
            <div className="mt-1 border-t border-line pt-3">
              <AnimatePresence initial={false} mode="wait">
                {!confirmarRemocao ? (
                  <motion.div
                    key="remover-inicio"
                    variants={crescer}
                    initial="oculto"
                    animate="visivel"
                    exit="saindo"
                  >
                    <Botao variante="fantasma" larguraTotal onClick={() => setConfirmarRemocao(true)} className="text-cancelada">
                      <UserMinus size={17} />
                      Remover acesso
                    </Botao>
                  </motion.div>
                ) : (
                  <motion.div
                    key="confirmar-remocao"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={MOLINHO}
                    className="flex flex-col gap-3 rounded-2xl border border-cancelada/30 bg-cancelada/8 p-3"
                  >
                    <p className="text-[13px] font-semibold leading-relaxed text-cancelada-ink">
                      Remover o acesso de {alvo.nome} de verdade? {primeiroNome(alvo.nome) || "A pessoa"} perde o app
                      na hora e vai precisar de um novo convite para voltar.
                    </p>
                    <div className="flex gap-2">
                      <Botao variante="neutro" larguraTotal onClick={() => setConfirmarRemocao(false)}>
                        <X size={17} />
                        Cancelar
                      </Botao>
                      <Botao
                        variante="perigo"
                        larguraTotal
                        disabled={remover.isPending}
                        onClick={removerAcesso}
                      >
                        <UserMinus size={17} />
                        {remover.isPending ? "Removendo..." : "Sim, remover"}
                      </Botao>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}

function LinhaUsuario({
  usuario,
  souEu,
  aoAbrir,
  aoAlternar,
}: {
  usuario: Usuario;
  souEu: boolean;
  aoAbrir: (u: Usuario) => void;
  aoAlternar: (u: Usuario) => void;
}) {
  const info = PAPEIS[usuario.papel];
  const Icone = info.icone;

  return (
    <motion.li
      layout
      variants={itemLista}
      initial="oculto"
      animate="visivel"
      exit="saindo"
      className={cn(
        "card flex items-center gap-1 overflow-hidden transition-opacity duration-300",
        !usuario.ativo && "opacity-60",
      )}
    >
      <motion.button
        type="button"
        whileTap={apertar}
        transition={MOLINHO}
        onClick={() => aoAbrir(usuario)}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 text-left"
      >
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full text-[14px] font-bold shadow-suave",
            info.avatar,
          )}
        >
          {iniciais(usuario.nome)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-tinta">{usuario.nome}</span>
            {souEu && <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-gold-600">você</span>}
          </span>
          <span className="block truncate text-xs text-tinta-3">{usuario.email}</span>
          <span className="mt-1.5 flex items-center gap-1.5 overflow-hidden">
            <Chip className={cn("shrink-0", info.chip)}>
              <Icone size={12} />
              {info.rotulo}
            </Chip>
            {!usuario.ativo && (
              <Chip className="shrink-0 border-cancelada/30 bg-cancelada/10 text-cancelada-ink">Desativado</Chip>
            )}
          </span>
          <span className="mt-1 block truncate text-[11px] font-medium text-tinta-3">
            {textoUltimoAcesso(usuario.ultimoAcesso)}
          </span>
        </span>

        <ChevronRight size={18} className="shrink-0 text-tinta-3" />
      </motion.button>

      <motion.button
        type="button"
        aria-label={usuario.ativo ? `Desligar o acesso de ${usuario.nome}` : `Ligar o acesso de ${usuario.nome}`}
        aria-pressed={usuario.ativo}
        whileTap={{ scale: 0.94 }}
        transition={MOLINHO}
        onClick={() => aoAlternar(usuario)}
        className={cn(
          "mr-1.5 flex h-11 w-[76px] shrink-0 items-center rounded-full border p-1 transition-colors duration-300",
          usuario.ativo
            ? "justify-end border-entregue/40 bg-entregue/30"
            : "justify-start border-line bg-neutro",
        )}
      >
        <motion.span
          layoutId={`piloto-acesso-${usuario.id}`}
          transition={MOLINHO_FIRME}
          className="grid size-9 place-items-center rounded-full bg-white shadow-suave"
        >
          {usuario.ativo ? <Check size={17} className="text-entregue" /> : <X size={17} className="text-tinta-3" />}
        </motion.span>
      </motion.button>
    </motion.li>
  );
}

function BotaoPapel({
  papel,
  ativo,
  aoEscolher,
}: {
  papel: Papel;
  ativo: boolean;
  aoEscolher: (papel: Papel) => void;
}) {
  const info = PAPEIS[papel];
  const Icone = info.icone;

  return (
    <motion.button
      type="button"
      whileTap={apertar}
      transition={MOLINHO}
      onClick={() => aoEscolher(papel)}
      aria-pressed={ativo}
      className={cn(
        "relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border p-3.5 text-left transition-colors duration-300",
        ativo ? "border-brand/40 bg-white" : "border-line bg-white/60",
      )}
    >
      {ativo && (
        <motion.span
          layoutId="piloto-papel"
          transition={MOLINHO}
          className="pointer-events-none absolute inset-0 rounded-2xl bg-brand/8"
        />
      )}
      <span className={cn("relative grid size-10 shrink-0 place-items-center rounded-xl shadow-suave", info.avatar)}>
        <Icone size={19} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-brand">{info.rotulo}</span>
          {ativo && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={MOLINHO}
              className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-gold-600"
            >
              escolhido
            </motion.span>
          )}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-tinta-2">{info.visto}</span>
      </span>
    </motion.button>
  );
}
