import { useEffect, useRef, useState } from "react";

export function useReduzirMovimento(): boolean {
  const [reduzido, setReduzido] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const virar = () => setReduzido(mq.matches);
    mq.addEventListener("change", virar);
    return () => mq.removeEventListener("change", virar);
  }, []);
  return reduzido;
}

/** Número que corre de um valor ao outro em vez de piscar a troca. */
export function useContagem(alvo: number, duracao = 620): number {
  const reduzido = useReduzirMovimento();
  const [mostrado, setMostrado] = useState(alvo);
  const desde = useRef(alvo);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (reduzido || desde.current === alvo) {
      desde.current = alvo;
      setMostrado(alvo);
      return;
    }
    const inicio = desde.current;
    const t0 = performance.now();
    const passo = (agora: number) => {
      const p = Math.min(1, (agora - t0) / duracao);
      const suave = 1 - Math.pow(1 - p, 3);
      const atual = inicio + (alvo - inicio) * suave;
      setMostrado(atual);
      if (p < 1) raf.current = requestAnimationFrame(passo);
      else desde.current = alvo;
    };
    raf.current = requestAnimationFrame(passo);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      desde.current = alvo;
    };
  }, [alvo, duracao, reduzido]);

  return mostrado;
}

export function vibrar(padroes: number | number[] = 12): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(padroes);
  }
}
