import { Component, type ReactNode } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Botao } from "@/shared/components/ui";
import { Simbolo } from "@/shared/components/Marca";

interface Estado {
  erro: Error | null;
}

/** Última rede de segurança: em vez de tela branca, devolve o card de "tentar de novo". */
export class FronteiraErro extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { erro: null };

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro };
  }

  render() {
    const { erro } = this.state;
    if (!erro) return this.props.children;

    return (
      <div className="fundo-quente flex min-h-dvh flex-col items-center justify-center gap-5 bg-crema px-6 text-center">
        <Simbolo tamanho={72} />
        <div className="flex flex-col items-center gap-2">
          <p className="font-display text-[22px] font-semibold text-brand">A cozinha travou aqui</p>
          <p className="max-w-[34ch] text-[13px] leading-snug text-tinta-2">
            Nenhum lançamento seu foi perdido — tudo continua guardado neste aparelho.
          </p>
        </div>

        <div className="card flex w-full max-w-[420px] flex-col gap-3 p-4 text-left">
          <p className="flex items-start gap-2 text-[12px] leading-snug text-preparada-ink">
            <TriangleAlert size={15} className="mt-px shrink-0" />
            <span className="min-w-0 flex-1 truncate font-mono">{erro.message || "erro inesperado"}</span>
          </p>
          <Botao variante="dourado" tamanho="lg" larguraTotal onClick={() => window.location.reload()}>
            <RotateCcw size={17} />
            Recarregar o app
          </Botao>
        </div>
      </div>
    );
  }
}
