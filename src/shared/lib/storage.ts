const CHAVE_BANCO = "marmitaria.banco.v1";
const CHAVE_FILA = "marmitaria.fila.v1";

export function lerBanco<T>(fallback: () => T): T {
  try {
    const bruto = localStorage.getItem(CHAVE_BANCO);
    if (!bruto) {
      const novo = fallback();
      gravarBanco(novo);
      return novo;
    }
    return JSON.parse(bruto) as T;
  } catch {
    return fallback();
  }
}

export function gravarBanco<T>(dados: T): void {
  try {
    localStorage.setItem(CHAVE_BANCO, JSON.stringify(dados));
  } catch {
    /* celular sem espaço: segue só em memória */
  }
}

/** Mudanças feitas sem internet voltam para a fila e são reenviadas quando online. */
export interface OperacaoFila {
  id: string;
  tabela: string;
  acao: "upsert" | "delete";
  payload: unknown;
}

export function lerFila(): OperacaoFila[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_FILA) ?? "[]") as OperacaoFila[];
  } catch {
    return [];
  }
}

export function empurrarFila(op: OperacaoFila): void {
  const fila = lerFila();
  const semDuplicada = fila.filter((i) => !(i.tabela === op.tabela && i.id === op.id));
  semDuplicada.push(op);
  localStorage.setItem(CHAVE_FILA, JSON.stringify(semDuplicada));
}

export function limparFila(): void {
  localStorage.setItem(CHAVE_FILA, "[]");
}

export function uid(prefixo = "id"): string {
  return `${prefixo}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
