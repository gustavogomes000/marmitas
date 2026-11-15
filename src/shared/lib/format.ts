const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const COMBINANTES = new RegExp("[\\u0300-\\u036f]", "g");

export function moeda(valor: number): string {
  return brl.format(valor ?? 0);
}

export function hojeISO(): string {
  return paraISO(new Date());
}

export function paraISO(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const dia = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function deISO(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, (m ?? 1) - 1, d ?? 1);
}

export function diaDaSemana(iso: string): string {
  return DIAS[deISO(iso).getDay()];
}

/** Quantos dias se passaram de `de` até `ate` (0 no mesmo dia). */
export function diasEntre(de: string, ate: string): number {
  return Math.max(0, Math.round((deISO(ate).getTime() - deISO(de).getTime()) / 86_400_000));
}

export function dataCurta(iso: string): string {
  const d = deISO(iso);
  return `${`${d.getDate()}`.padStart(2, "0")}/${`${d.getMonth() + 1}`.padStart(2, "0")}`;
}

export function dataLonga(iso: string): string {
  const d = deISO(iso);
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function rotuloRelativo(iso: string): string {
  const hoje = hojeISO();
  if (iso === hoje) return "Hoje";
  const ontem = paraISO(new Date(deISO(hoje).getTime() - 86_400_000));
  if (iso === ontem) return "Ontem";
  return `${diaDaSemana(iso).slice(0, 3)}, ${dataCurta(iso)}`;
}

export function hora(isoDataHora: string): string {
  const d = new Date(isoDataHora);
  return `${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
}

/** Aceita "12,50", "R$ 12.50" ou "12.5" e devolve número. */
export function paraNumero(texto: string | number | null | undefined): number {
  if (typeof texto === "number") return Number.isFinite(texto) ? texto : 0;
  if (!texto) return 0;
  const limpo = texto.replace(/[^\d,.-]/g, "");
  const n = Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo);
  return Number.isFinite(n) ? n : 0;
}

/** "Pastora Cida" -> "pastora cida". Base para conferir o nome colado do grupo. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(COMBINANTES, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function primeiroNome(texto: string): string {
  return normalizar(texto).split(" ")[0] ?? "";
}

export function tokens(texto: string): string[] {
  return normalizar(texto).split(" ").filter(Boolean);
}
