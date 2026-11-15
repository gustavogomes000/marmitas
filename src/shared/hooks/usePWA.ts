import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

let eventoInstalacaoGlobal: BeforeInstallPromptEvent | null = null;
const ouvintes = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoInstalacaoGlobal = e as BeforeInstallPromptEvent;
    ouvintes.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    eventoInstalacaoGlobal = null;
    ouvintes.forEach((fn) => fn());
  });
}

export function usePWA() {
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [instalado, setInstalado] = useState(() => {
    if (typeof window === "undefined") return false;
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = Boolean((navigator as unknown as { standalone?: boolean }).standalone);
    return standalone || iosStandalone;
  });
  const [podeInstalar, setPodeInstalar] = useState(() => Boolean(eventoInstalacaoGlobal));

  const ehIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;

  useEffect(() => {
    const atualizarRede = () => setOnline(navigator.onLine);
    const atualizarPWA = () => {
      setPodeInstalar(Boolean(eventoInstalacaoGlobal));
      setInstalado(
        window.matchMedia("(display-mode: standalone)").matches ||
          Boolean((navigator as unknown as { standalone?: boolean }).standalone),
      );
    };

    window.addEventListener("online", atualizarRede);
    window.addEventListener("offline", atualizarRede);
    ouvintes.add(atualizarPWA);

    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", atualizarPWA);

    return () => {
      window.removeEventListener("online", atualizarRede);
      window.removeEventListener("offline", atualizarRede);
      ouvintes.delete(atualizarPWA);
      mq.removeEventListener("change", atualizarPWA);
    };
  }, []);

  async function instalar(): Promise<boolean> {
    if (!eventoInstalacaoGlobal) return false;
    await eventoInstalacaoGlobal.prompt();
    const escolha = await eventoInstalacaoGlobal.userChoice;
    if (escolha.outcome === "accepted") {
      eventoInstalacaoGlobal = null;
      setPodeInstalar(false);
      return true;
    }
    return false;
  }

  return { online, instalado, podeInstalar, ehIOS, instalar };
}

