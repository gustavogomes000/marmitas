import type { StatusVenda } from "@/domain/types";

export const ORDEM_STATUS: StatusVenda[] = ["pendente", "preparada", "entregue"];

export interface CorStatus {
  rotulo: string;
  curto: string;
  /** Fundo + borda quando o botão está ligado. */
  ativo: string;
  /** Botão ligado em cor sólida. */
  solido: string;
  /** O card inteiro assume essa aparência quando o pedido está neste estado. */
  card: string;
  /** Fundo sólido (bolinha do status). */
  cheio: string;
  /** Botão desligado. */
  inativo: string;
  chip: string;
  ponto: string;
  barra: string;
  texto: string;
}

export const PENDENTE: CorStatus = {
  rotulo: "Pendente",
  curto: "Pend.",
  ativo: "border-neutro-ink/40 bg-neutro/70 text-neutro-ink",
  solido: "border-neutro-ink bg-neutro-ink text-white",
  card: "[--card-fundo:#fff] [--card-borda:var(--color-line)]",
  cheio: "bg-neutro-ink/60",
  inativo: "border-line bg-white text-tinta-3",
  chip: "bg-neutro/70 text-neutro-ink border-neutro",
  ponto: "bg-neutro-ink/60",
  barra: "bg-neutro",
  texto: "text-neutro-ink",
};

export const PREPARADA: CorStatus = {
  rotulo: "Preparada",
  curto: "Pronta",
  ativo: "border-preparada bg-gold-soft text-preparada-ink",
  solido: "border-preparada bg-preparada text-brand-ink",
  card: "[--card-fundo:var(--color-gold-soft)] [--card-borda:var(--color-gold-300)]",
  cheio: "bg-preparada",
  inativo: "border-line bg-white text-tinta-3",
  chip: "bg-gold-soft text-preparada-ink border-gold-300",
  ponto: "bg-preparada",
  barra: "bg-preparada",
  texto: "text-preparada-ink",
};

export const ENTREGUE: CorStatus = {
  rotulo: "Entregue",
  curto: "Entreg.",
  ativo: "border-entregue bg-entregue/14 text-entregue-ink",
  solido: "border-entregue bg-entregue text-white",
  card: "[--card-fundo:#eef4ff] [--card-borda:#93c5fd]",
  cheio: "bg-entregue",
  inativo: "border-line bg-white text-tinta-3",
  chip: "bg-entregue/12 text-entregue-ink border-entregue/30",
  ponto: "bg-entregue",
  barra: "bg-entregue",
  texto: "text-entregue-ink",
};

export const PAGA: CorStatus = {
  rotulo: "Paga",
  curto: "Paga",
  ativo: "border-paga bg-paga-soft text-paga-ink",
  solido: "border-paga bg-paga text-white",
  card: "[--card-fundo:#bbf7d0] [--card-borda:#22c55e]",
  cheio: "bg-paga",
  inativo: "border-line bg-white text-tinta-3",
  chip: "bg-paga-soft text-paga-ink border-paga/40",
  ponto: "bg-paga",
  barra: "bg-paga",
  texto: "text-paga-ink",
};

export const CANCELADA: CorStatus = {
  rotulo: "Cancelada",
  curto: "Cancel.",
  ativo: "border-cancelada bg-cancelada/10 text-cancelada-ink",
  solido: "border-cancelada bg-cancelada text-white",
  card: "[--card-fundo:color-mix(in_srgb,var(--color-cancelada)_8%,#fff)] [--card-borda:color-mix(in_srgb,var(--color-cancelada)_30%,#fff)]",
  cheio: "bg-cancelada",
  inativo: "border-line bg-white text-tinta-3",
  chip: "bg-cancelada/10 text-cancelada-ink border-cancelada/30",
  ponto: "bg-cancelada",
  barra: "bg-cancelada",
  texto: "text-cancelada-ink",
};

export const APARENCIA: Record<StatusVenda, CorStatus> = {
  pendente: PENDENTE,
  preparada: PREPARADA,
  entregue: ENTREGUE,
  cancelada: CANCELADA,
};

/** Um toque avança pendente -> preparada -> entregue -> pendente. */
export function proximoStatus(atual: StatusVenda): StatusVenda {
  if (atual === "cancelada") return "pendente";
  const i = ORDEM_STATUS.indexOf(atual);
  return ORDEM_STATUS[(i + 1) % ORDEM_STATUS.length];
}

/** Montada = preparada + entregue (quem foi entregue já passou pela bancada). */
export function estaMontada(status: StatusVenda): boolean {
  return status === "preparada" || status === "entregue";
}
