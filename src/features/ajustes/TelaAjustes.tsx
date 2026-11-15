import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bike,
  ChartColumnBig,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  Database,
  Download,
  KeyRound,
  Lightbulb,
  MonitorPlay,
  RefreshCw,
  Share,
  Smartphone,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { Papel } from "@/domain/types";
import { ehAdm, useSessao } from "@/features/auth/sessao";
import { verificarStatusBanco } from "@/data/supabase";
import { Botao, Cartao, Chip, TituloSecao } from "@/shared/components/ui";
import { useTitulo } from "@/app/Layout";
import { vibrar } from "@/shared/hooks/useAnimacao";
import { usePWA } from "@/shared/hooks/usePWA";
import { MOLINHO, apertar, itemLista, listaStagger } from "@/shared/lib/motion";
import { cn } from "@/shared/lib/cn";

const ROTULO_PAPEL: Record<Papel, { rotulo: string; chip: string }> = {
  adm: { rotulo: "Administra tudo", chip: "border-brand/25 bg-brand-soft text-brand" },
  cozinha: { rotulo: "Cozinha", chip: "border-gold-300 bg-gold-soft text-preparada-ink" },
  entregador: { rotulo: "Entregador", chip: "border-entregue/30 bg-entregue/12 text-entregue-ink" },
};

const MELHORIAS: { titulo: string; descricao: string }[] = [
  {
    titulo: "Aviso de pedido novo no grupo",
    descricao: "Notificação no celular assim que chegar mensagem de pedido, sem precisar abrir o app.",
  },
  {
    titulo: "Ler a mensagem por foto",
    descricao: "Tirar foto da tela do WhatsApp e o app transforma os pedidos na lista do dia.",
  },
  {
    titulo: "Relatório semanal por cliente",
    descricao: "Quem compra mais, quem sumiu e quantas marmitas cada um leva na semana.",
  },
  {
    titulo: "Estoque de insumos",
    descricao: "Arroz, óleo e carne baixando conforme as saídas registradas no caixa.",
  },
  {
    titulo: "Taxa e rota por entregador",
    descricao: "Custo de cada entrega e a ordem das paradas do dia, rua por rua.",
  },
  {
    titulo: "Modo escuro na TV",
    descricao: "Painel da cozinha escurece sozinho à noite para não ofuscar a vista.",
  },
  {
    titulo: "Backup e caixa em CSV",
    descricao: "Exportar o mês inteiro em planilha e guardar uma cópia de segurança dos dados.",
  },
  {
    titulo: "Mais de uma loja",
    descricao: "Quando crescer, cada ponto de venda com dia, caixa e equipe próprios.",
  },
];

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.slice(0, 1))
    .join("")
    .toUpperCase();
}

export function TelaAjustes() {
  const sessao = useSessao((s) => s.sessao);
  const entrarRapido = useSessao((s) => s.entrarRapido);
  const qc = useQueryClient();
  const { online, instalado, podeInstalar, ehIOS, instalar } = usePWA();
  useTitulo("Mais");

  const [statusBanco, setStatusBanco] = useState<"conectado" | "pendente_sql" | "demo">("conectado");
  const [testandoBanco, setTestandoBanco] = useState(false);

  useEffect(() => {
    void verificarStatusBanco().then(setStatusBanco);
  }, []);

  async function testarConexao() {
    setTestandoBanco(true);
    vibrar(8);
    const novo = await verificarStatusBanco();
    setStatusBanco(novo);
    await qc.invalidateQueries();
    setTestandoBanco(false);
    if (novo === "conectado") {
      toast.success("Banco Supabase conectado!", {
        description: "Todas as tabelas estão prontas e sincronizando em tempo real.",
      });
    } else if (novo === "pendente_sql") {
      toast("Falta rodar o SQL no Supabase", {
        description: "Cole o script supabase/schema.sql no SQL Editor do projeto e clique em Run.",
      });
    } else {
      toast("Modo demonstração ativo");
    }
  }

  const versao = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "1.0.0";
  const papel = sessao?.papel ?? "adm";
  const info = ROTULO_PAPEL[papel];

  const PERFIS_RAPIDOS = [
    { id: "usr_marcia", rotulo: "Márcia (Admin)" },
    { id: "usr_cozinha", rotulo: "Cozinha" },
    { id: "usr_entrega", rotulo: "Entregador" },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <Cartao className="p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-13 shrink-0 place-items-center rounded-2xl bg-brand font-display text-[16px] font-bold text-crema shadow-suave">
            {iniciais(sessao?.nome ?? "M")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[18px] font-semibold text-brand">{sessao?.nome ?? "Márcia"}</p>
            <p className="truncate text-xs text-tinta-3">{sessao?.email ?? "marcia@marmitaria.com"}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Chip className={info.chip}>{info.rotulo}</Chip>
              <Chip
                className={
                  online
                    ? "border-entregue/30 bg-entregue/10 text-entregue-ink"
                    : "border-gold-300 bg-gold-soft text-preparada-ink"
                }
              >
                {online ? <Wifi size={11} /> : <WifiOff size={11} />}
                {online ? "Online" : "Offline"}
              </Chip>
            </div>
          </div>
        </div>
        <div className="mt-3.5 border-t border-line pt-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-tinta-3">
            Alternar perfil ativo (entrada direta)
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {PERFIS_RAPIDOS.map((p) => {
              const ativo = sessao?.usuarioId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    vibrar(8);
                    void entrarRapido(p.id, true);
                    toast.success(`Perfil ativo: ${p.rotulo}`);
                  }}
                  className={cn(
                    "rounded-xl border px-2 py-2 text-center text-[11.5px] font-semibold transition-all active:scale-96",
                    ativo
                      ? "border-brand bg-brand text-crema shadow-suave"
                      : "border-line bg-crema-2/60 text-tinta-2",
                  )}
                >
                  {p.rotulo}
                </button>
              );
            })}
          </div>
        </div>
      </Cartao>

      <div className="flex flex-col gap-2.5">
        <TituloSecao>Atalhos da operação</TituloSecao>
        <div className="grid grid-cols-2 gap-2.5">
          <CartaoAtalho
            rotulo="Cozinha"
            descricao="Fila para montar"
            icone={ChefHat}
            cor="bg-gold-soft text-preparada-ink"
            para="/cozinha"
          />
          <CartaoAtalho
            rotulo="Entregas"
            descricao="Rotas e motoboys"
            icone={Bike}
            cor="bg-entregue/12 text-entregue-ink"
            para="/entregas"
          />
        </div>
        <Linha
          rotulo="Vendas por dia"
          descricao="Compare quanto vendeu em cada dia do mês"
          icone={ChartColumnBig}
          para="/vendas"
        />
        <Linha
          rotulo="Acessos de usuário"
          descricao="Ligar, desligar e trocar o papel de quem entra no app"
          icone={KeyRound}
          para="/usuarios"
          aviso={!ehAdm(papel) ? "Só a administradora abre esta tela" : undefined}
        />
        <Linha
          rotulo="Painel da TV"
          descricao="Abre em tela cheia na TV da cozinha"
          icone={MonitorPlay}
          aoClicar={() => {
            vibrar(10);
            window.open("/tv", "_blank");
          }}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <TituloSecao>Aplicativo no celular (PWA)</TituloSecao>
        <Cartao className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold-soft text-preparada-ink">
              <Smartphone size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-tinta">
                {instalado ? (
                  <>
                    <CheckCircle2 size={16} className="shrink-0 text-entregue" />
                    <span className="truncate">Instalado na tela inicial</span>
                  </>
                ) : (
                  <span className="truncate">Instalar como aplicativo</span>
                )}
              </p>
              <p className="mt-1 text-[13px] leading-snug text-tinta-2">
                {instalado
                  ? "Você já está usando o app em tela cheia e com suporte para funcionar mesmo quando a internet oscilar."
                  : ehIOS
                    ? "No iPhone/iPad: toque no botão Compartilhar do Safari e escolha “Adicionar à Tela de Início”."
                    : "Adicione o ícone da D'a Márcia na tela inicial do celular para abrir em tela cheia como aplicativo nativo."}
              </p>
            </div>
          </div>

          {!instalado && podeInstalar && (
            <Botao
              variante="dourado"
              tamanho="md"
              larguraTotal
              onClick={async () => {
                vibrar(10);
                const aceitou = await instalar();
                if (aceitou) toast.success("Aplicativo instalado com sucesso!");
              }}
            >
              <Download size={17} />
              Instalar aplicativo agora
            </Botao>
          )}

          {!instalado && ehIOS && (
            <div className="flex items-center gap-2 rounded-2xl border border-gold-300 bg-gold-soft/70 px-3.5 py-2.5 text-[12.5px] font-semibold text-preparada-ink">
              <Share size={16} className="shrink-0" />
              <span>Toque em Compartilhar → Adicionar à Tela de Início</span>
            </div>
          )}
        </Cartao>
      </div>

      <div className="flex flex-col gap-2.5">
        <TituloSecao>Banco de dados (Supabase)</TituloSecao>
        <Cartao className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
              <Database size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-tinta">
                <motion.span
                  animate={{ opacity: [1, 0.45, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    statusBanco === "conectado" ? "bg-entregue" : "bg-preparada",
                  )}
                />
                <span className="truncate">
                  {statusBanco === "conectado"
                    ? "Conectado ao Supabase (Banco Real)"
                    : statusBanco === "pendente_sql"
                      ? "Aguardando rodar o SQL no Supabase"
                      : "Rodando em modo demonstração"}
                </span>
              </p>
              <p className="mt-1 text-[13px] leading-snug text-tinta-2">
                {statusBanco === "conectado"
                  ? "Todos os pedidos, lançamentos de caixa, contas e entregas estão salvos no banco em nuvem e sincronizados."
                  : statusBanco === "pendente_sql"
                    ? "As chaves já estão conectadas! Assim que você rodar o SQL no painel do Supabase, o app passa a gravar tudo no banco real."
                    : "Os dados ficam salvos neste aparelho até conectar o Supabase."}
              </p>
            </div>
          </div>
          <Botao
            variante="neutro"
            tamanho="sm"
            larguraTotal
            carregando={testandoBanco}
            onClick={() => void testarConexao()}
          >
            <RefreshCw size={15} />
            Verificar sincronização com o banco
          </Botao>
        </Cartao>
      </div>

      <div className="flex flex-col gap-2.5">
        <TituloSecao>Próximas evoluções</TituloSecao>
        <p className="px-1 text-[13px] leading-snug text-tinta-2">
          Ordem pensada para o dia a dia da marmitaria:
        </p>
        <motion.ul variants={listaStagger} initial="oculto" animate="visivel" className="flex flex-col gap-2">
          {MELHORIAS.map((item, indice) => (
            <motion.li key={item.titulo} variants={itemLista} className="card flex items-start gap-3 p-3.5">
              <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-gold text-[12px] font-bold text-brand-ink shadow-suave">
                {indice + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-tinta">{item.titulo}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-tinta-2">{item.descricao}</p>
              </div>
            </motion.li>
          ))}
        </motion.ul>
        <div className="flex items-center gap-2 px-1 pt-1 text-tinta-3">
          <Lightbulb size={15} />
          <p className="text-[12px] leading-snug">Ideias mapeadas para os próximos ciclos.</p>
        </div>
      </div>

      <footer className="flex flex-col items-center gap-1 pb-2 pt-1 text-center">
        <p className="font-display text-[15px] font-semibold text-brand">D'a Márcia Marmitaria</p>
        <p className="num text-[11px] font-semibold tracking-wide text-tinta-3">versão {versao} · PWA</p>
      </footer>
    </div>
  );
}

function CartaoAtalho({
  rotulo,
  descricao,
  icone: Icone,
  cor,
  para,
}: {
  rotulo: string;
  descricao: string;
  icone: typeof Bike;
  cor: string;
  para: string;
}) {
  return (
    <motion.div whileTap={apertar} transition={MOLINHO} className="card overflow-hidden">
      <Link to={para} onClick={() => vibrar(6)} className="flex flex-col gap-2 p-3.5">
        <div className="flex items-center justify-between">
          <span className={cn("grid size-10 place-items-center rounded-2xl", cor)}>
            <Icone size={20} />
          </span>
          <ChevronRight size={17} className="text-tinta-3" />
        </div>
        <div>
          <p className="font-display text-[16px] font-semibold text-tinta">{rotulo}</p>
          <p className="truncate text-[12px] text-tinta-3">{descricao}</p>
        </div>
      </Link>
    </motion.div>
  );
}

function Linha({
  rotulo,
  descricao,
  icone: Icone,
  para,
  aoClicar,
  aviso,
}: {
  rotulo: string;
  descricao: string;
  icone: typeof Bike;
  para?: string;
  aoClicar?: () => void;
  aviso?: string;
}) {
  const conteudo = (
    <>
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icone size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-tinta">{rotulo}</span>
        <span className="block truncate text-[12px] leading-snug text-tinta-3">{aviso ?? descricao}</span>
      </span>
      <ChevronRight size={19} className={cn("shrink-0", aviso ? "text-tinta-3/60" : "text-tinta-3")} />
    </>
  );

  const classes = "flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left";

  return (
    <motion.div
      whileTap={apertar}
      transition={MOLINHO}
      className={cn("card flex items-stretch overflow-hidden", aviso && "opacity-70")}
    >
      {para ? (
        <Link to={para} onClick={() => vibrar(6)} className={classes}>
          {conteudo}
        </Link>
      ) : (
        <motion.button type="button" onClick={aoClicar} className={classes}>
          {conteudo}
        </motion.button>
      )}
    </motion.div>
  );
}
