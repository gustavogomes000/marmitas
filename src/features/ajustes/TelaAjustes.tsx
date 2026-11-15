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
  MonitorPlay,
  RefreshCw,
  Share,
  Smartphone,
  Wifi,
  WifiOff,
} from "lucide-react";
import { verificarStatusBanco } from "@/data/supabase";
import { Botao, Cartao, Chip, TituloSecao } from "@/shared/components/ui";
import { useTitulo } from "@/app/Layout";
import { vibrar } from "@/shared/hooks/useAnimacao";
import { usePWA } from "@/shared/hooks/usePWA";
import { MOLINHO, apertar } from "@/shared/lib/motion";
import { cn } from "@/shared/lib/cn";

export function TelaAjustes() {
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
      toast.success("Banco sincronizado!");
    } else if (novo === "pendente_sql") {
      toast("Falta rodar o SQL no Supabase");
    } else {
      toast("Modo local ativo");
    }
  }

  const versao = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "1.0.0";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        <TituloSecao>Operação</TituloSecao>
        <div className="grid grid-cols-2 gap-2.5">
          <CartaoAtalho
            rotulo="Cozinha"
            descricao="Fila de preparo"
            icone={ChefHat}
            cor="bg-gold-soft text-preparada-ink"
            para="/cozinha"
          />
          <CartaoAtalho
            rotulo="Entregas"
            descricao="Entregadores e rotas"
            icone={Bike}
            cor="bg-entregue/12 text-entregue-ink"
            para="/entregas"
          />
        </div>
        <Linha
          rotulo="Vendas por dia"
          descricao="Histórico de vendas"
          icone={ChartColumnBig}
          para="/vendas"
        />
        <Linha
          rotulo="Painel da TV"
          descricao="Tela cheia para a cozinha"
          icone={MonitorPlay}
          aoClicar={() => {
            vibrar(10);
            window.open("/tv", "_blank");
          }}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <TituloSecao>Sistema</TituloSecao>
        <Cartao className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                <Database size={19} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-semibold text-tinta">
                  {statusBanco === "conectado" ? "Banco conectado" : "Banco local"}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Chip
                    className={
                      online
                        ? "border-paga/30 bg-paga-soft text-paga-ink"
                        : "border-gold-300 bg-gold-soft text-preparada-ink"
                    }
                  >
                    {online ? <Wifi size={11} /> : <WifiOff size={11} />}
                    {online ? "Online" : "Offline"}
                  </Chip>
                </div>
              </div>
            </div>
            <Botao
              variante="neutro"
              tamanho="sm"
              carregando={testandoBanco}
              onClick={() => void testarConexao()}
            >
              <RefreshCw size={14} />
              Sincronizar
            </Botao>
          </div>
        </Cartao>

        <Cartao className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gold-soft text-preparada-ink">
                <Smartphone size={19} />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-[14.5px] font-semibold text-tinta">
                  {instalado ? (
                    <>
                      <CheckCircle2 size={15} className="shrink-0 text-paga" />
                      <span className="truncate">Aplicativo instalado</span>
                    </>
                  ) : (
                    <span className="truncate">Aplicativo no celular</span>
                  )}
                </p>
              </div>
            </div>
            {!instalado && podeInstalar && (
              <Botao
                variante="dourado"
                tamanho="sm"
                onClick={async () => {
                  vibrar(10);
                  const aceitou = await instalar();
                  if (aceitou) toast.success("Aplicativo instalado!");
                }}
              >
                <Download size={15} />
                Instalar
              </Botao>
            )}
          </div>

          {!instalado && ehIOS && (
            <div className="flex items-center gap-2 rounded-2xl border border-gold-300 bg-gold-soft/70 px-3 py-2 text-[12px] font-semibold text-preparada-ink">
              <Share size={15} className="shrink-0" />
              <span>Compartilhar → Adicionar à Tela de Início</span>
            </div>
          )}
        </Cartao>
      </div>

      <footer className="flex flex-col items-center gap-0.5 pb-2 pt-1 text-center">
        <p className="font-display text-[14px] font-semibold text-brand">D'a Márcia Marmitaria</p>
        <p className="num text-[11px] font-semibold tracking-wide text-tinta-3">v{versao}</p>
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
}: {
  rotulo: string;
  descricao: string;
  icone: typeof Bike;
  para?: string;
  aoClicar?: () => void;
}) {
  const conteudo = (
    <>
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icone size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-tinta">{rotulo}</span>
        <span className="block truncate text-[12px] leading-snug text-tinta-3">{descricao}</span>
      </span>
      <ChevronRight size={19} className="shrink-0 text-tinta-3" />
    </>
  );

  const classes = "flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left";

  return (
    <motion.div whileTap={apertar} transition={MOLINHO} className="card flex items-stretch overflow-hidden">
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
