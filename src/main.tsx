import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { toast } from "sonner";
import { registerSW } from "virtual:pwa-register";
import "./styles/index.css";
import { App } from "@/app/App";
import { FronteiraErro } from "@/shared/components/FronteiraErro";
import { despejarFila } from "@/data/supabase";
import { supabaseConfigurado } from "@/shared/lib/env";

const cliente = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: true },
  },
});

registerSW({
  immediate: true,
  onOfflineReady() {
    toast.success("App pronto offline", { description: "Abre pelo ícone e funciona sem internet." });
  },
  onNeedRefresh() {
    toast("Nova versão disponível", {
      action: { label: "Atualizar", onClick: () => window.location.reload() },
      duration: 8000,
    });
  },
});

window.addEventListener("online", async () => {
  if (!supabaseConfigurado) return;
  const despejado = await despejarFila().catch(() => 0);
  if (despejado) toast.success(`${despejado} ajuste(s) enviados para o banco`);
  void cliente.invalidateQueries();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <BrowserRouter>
        <FronteiraErro>
          <App />
        </FronteiraErro>
        <Toaster
          position="top-center"
          offset={{ top: "calc(env(safe-area-inset-top, 0px) + 64px)", left: 16, right: 16 }}
          mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 64px)", left: 14, right: 14 }}
          toastOptions={{
            style: {
              borderRadius: 16,
              border: "1px solid #EADDD1",
              background: "#fff",
              color: "#241C19",
              boxShadow: "0 18px 40px -18px rgba(82,16,17,.32)",
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

const splash = document.getElementById("tela-splash");
if (splash) {
  const finalizarSplash = () => {
    window.setTimeout(() => {
      splash.classList.add("saindo");
      window.setTimeout(() => splash.remove(), 680);
    }, 3000);
  };
  const img = splash.querySelector("img");
  if (img && !img.complete) {
    img.addEventListener("load", finalizarSplash, { once: true });
    img.addEventListener("error", finalizarSplash, { once: true });
  } else {
    finalizarSplash();
  }
}
