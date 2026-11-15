import type { Variants } from "motion/react";

export const MOLINHO = { type: "spring", stiffness: 420, damping: 30, mass: 0.8 } as const;
export const MOLINHO_FIRME = { type: "spring", stiffness: 560, damping: 38 } as const;
export const SUAVE = { duration: 0.28, ease: [0.22, 1, 0.36, 1] } as const;

export const subir: Variants = {
  oculto: { opacity: 0, y: 16, filter: "blur(4px)" },
  visivel: { opacity: 1, y: 0, filter: "blur(0px)", transition: SUAVE },
};

export const listaStagger: Variants = {
  oculto: {},
  visivel: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } },
};

export const itemLista: Variants = {
  oculto: { opacity: 0, y: 12, scale: 0.98 },
  visivel: { opacity: 1, y: 0, scale: 1, transition: MOLINHO },
  saindo: { opacity: 0, x: -24, height: 0, marginTop: 0, transition: SUAVE },
};

export const entrarEsquerda: Variants = {
  oculto: { opacity: 0, x: -28 },
  visivel: { opacity: 1, x: 0, transition: MOLINHO },
  saindo: { opacity: 0, x: -28, transition: SUAVE },
};

export const crescer: Variants = {
  oculto: { opacity: 0, height: 0 },
  visivel: { opacity: 1, height: "auto", transition: SUAVE },
  saindo: { opacity: 0, height: 0, transition: SUAVE },
};

export const apertar = { scale: 0.965 } as const;
