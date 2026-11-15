import { db } from "@/shared/lib/supabase";
import { empurrarFila, lerFila, limparFila } from "@/shared/lib/storage";
import type {
  Categoria,
  Conta,
  DiaVenda,
  Entregador,
  Movimentacao,
  ResumoDia,
  Usuario,
  Venda,
  VendaEmAberto,
} from "@/domain/types";
import { calcularTotais, faltaReceber } from "@/domain/totais";
import { diasEntre } from "@/shared/lib/format";
import { repositorioDemo } from "./demo";
import type { Repositorio } from "./repositorio";

/* As tabelas chegam em snake_case do Postgres; o app inteiro fala camelCase. */

interface Linha {
  [chave: string]: unknown;
}

function tabelaAusente(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const code = (erro as { code?: string }).code;
  const msg = String((erro as { message?: string }).message ?? "");
  return code === "PGRST205" || code === "42P01" || msg.includes("Could not find the table");
}

export async function verificarStatusBanco(): Promise<"conectado" | "pendente_sql" | "demo"> {
  if (!db) return "demo";
  try {
    const { error } = await db.from("categorias").select("id").limit(1);
    if (error) {
      if (tabelaAusente(error)) return "pendente_sql";
      return "pendente_sql";
    }
    return "conectado";
  } catch {
    return "pendente_sql";
  }
}

/** Coluna numeric nullable: sem valor — ou valor lixo — devolve null em vez de NaN. */
function numeroOpcional(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function paraCategoria(l: Linha): Categoria {
  return {
    id: String(l.id),
    nome: String(l.nome),
    fluxo: l.fluxo === "entrada" ? "entrada" : "saida",
    emoji: String(l.emoji ?? "🧾"),
    cor: String(l.cor ?? "text-saida"),
    ordem: Number(l.ordem ?? 0),
  };
}

function paraMovimentacao(l: Linha): Movimentacao {
  return {
    id: String(l.id),
    data: String(l.data),
    descricao: String(l.descricao ?? ""),
    valor: Number(l.valor ?? 0),
    fluxo: l.fluxo === "entrada" ? "entrada" : "saida",
    categoriaId: String(l.categoria_id ?? ""),
    forma: (l.forma as Movimentacao["forma"]) ?? "outro",
    obs: String(l.obs ?? ""),
    criadoEm: String(l.criado_em ?? new Date().toISOString()),
  };
}

function paraDia(l: Linha): DiaVenda {
  return {
    id: String(l.id),
    data: String(l.data),
    precoMarmita: Number(l.preco_marmita ?? 0),
    obs: String(l.obs ?? ""),
    prato: l.prato ? String(l.prato) : "",
    criadoEm: String(l.criado_em ?? new Date().toISOString()),
    fechadoEm: l.fechado_em ? String(l.fechado_em) : null,
  };
}

function paraConta(l: Linha): Conta {
  return {
    id: String(l.id),
    descricao: String(l.descricao ?? ""),
    fornecedor: String(l.fornecedor ?? ""),
    valor: Number(l.valor ?? 0),
    vencimento: String(l.vencimento),
    categoriaId: String(l.categoria_id ?? ""),
    forma: (l.forma as Conta["forma"]) ?? "outro",
    paga: Boolean(l.paga),
    pagoEm: l.pago_em ? String(l.pago_em) : null,
    grupo: l.grupo ? String(l.grupo) : null,
    parcela: numeroOpcional(l.parcela),
    parcelas: numeroOpcional(l.parcelas),
    obs: String(l.obs ?? ""),
  };
}

function linhaConta(c: Conta): Linha {
  return {
    id: c.id,
    descricao: c.descricao,
    fornecedor: c.fornecedor,
    valor: c.valor,
    vencimento: c.vencimento,
    categoria_id: c.categoriaId || null,
    forma: c.forma,
    paga: c.paga,
    pago_em: c.pagoEm,
    grupo: c.grupo,
    parcela: c.parcela,
    parcelas: c.parcelas,
    obs: c.obs,
  };
}

function paraVenda(l: Linha): Venda {
  return {
    id: String(l.id),
    diaId: String(l.dia_id),
    cliente: String(l.cliente ?? ""),
    qtd: Number(l.qtd ?? 1),
    pg: Boolean(l.pg),
    paga: Boolean(l.paga),
    entreguePor: l.entregue_por ? String(l.entregue_por) : null,
    status: (l.status as Venda["status"]) ?? "pendente",
    obs: String(l.obs ?? ""),
    ordem: Number(l.ordem ?? 0),
    valorUnit: numeroOpcional(l.valor_unit),
    acrescimo: numeroOpcional(l.acrescimo) ?? 0,
    valorPago: numeroOpcional(l.valor_pago),
  };
}

function paraUsuario(l: Linha): Usuario {
  return {
    id: String(l.id),
    nome: String(l.nome ?? ""),
    email: String(l.email ?? ""),
    papel: (l.papel as Usuario["papel"]) ?? "cozinha",
    ativo: Boolean(l.ativo),
    criadoEm: String(l.criado_em ?? new Date().toISOString()),
    ultimoAcesso: l.ultimo_acesso ? String(l.ultimo_acesso) : null,
  };
}

function paraEntregador(l: Linha): Entregador {
  return { id: String(l.id), nome: String(l.nome ?? ""), telefone: String(l.telefone ?? ""), ativo: Boolean(l.ativo) };
}

/** Venda -> linha snake_case: é o que se grava no Postgres e o que fica na fila offline. */
function linhaVenda(v: Venda): Linha {
  return {
    id: v.id,
    dia_id: v.diaId,
    cliente: v.cliente,
    qtd: v.qtd,
    pg: v.pg,
    paga: v.paga,
    entregue_por: v.entreguePor || null,
    status: v.status,
    obs: v.obs,
    ordem: v.ordem,
    valor_unit: v.valorUnit,
    acrescimo: v.acrescimo,
    valor_pago: v.valorPago,
  };
}

function cliente() {
  if (!db) throw new Error("Supabase não configurado");
  return db;
}

/** Sem internet a operação vai para a fila local e o app continua usando o cache. */
async function comFila(
  tabela: string,
  acao: "upsert" | "delete",
  payload: object,
  executar: () => PromiseLike<unknown>,
  fallbackDemo?: () => Promise<unknown>,
) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    empurrarFila({ id: String((payload as { id?: string }).id ?? tabela), tabela, acao, payload });
    return;
  }
  try {
    await executar();
  } catch (e) {
    if (tabelaAusente(e) && fallbackDemo) {
      await fallbackDemo();
      return;
    }
    throw e;
  }
}

const diasGarantidos = new Set<string>();

export const repositorioSupabase: Repositorio = {
  async usuarios() {
    const { data, error } = await cliente().from("perfis").select("*").order("nome");
    if (error) {
      if (tabelaAusente(error)) return repositorioDemo.usuarios();
      throw error;
    }
    return (data ?? []).map(paraUsuario);
  },
  async salvarUsuario(usuario) {
    await comFila(
      "perfis",
      "upsert",
      usuario,
      () =>
        cliente()
          .from("perfis")
          .upsert({
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            papel: usuario.papel,
            ativo: usuario.ativo,
            criado_em: usuario.criadoEm,
            ultimo_acesso: usuario.ultimoAcesso,
          })
          .throwOnError(),
      () => repositorioDemo.salvarUsuario(usuario),
    );
  },
  async removerUsuario(id) {
    await comFila(
      "perfis",
      "delete",
      { id },
      () => cliente().from("perfis").delete().eq("id", id).throwOnError(),
      () => repositorioDemo.removerUsuario(id),
    );
  },

  async categorias() {
    const { data, error } = await cliente().from("categorias").select("*").order("fluxo").order("ordem");
    if (error) {
      if (tabelaAusente(error)) return repositorioDemo.categorias();
      throw error;
    }
    return (data ?? []).map(paraCategoria);
  },
  async salvarCategoria(categoria) {
    await comFila(
      "categorias",
      "upsert",
      categoria,
      () =>
        cliente()
          .from("categorias")
          .upsert({
            id: categoria.id,
            nome: categoria.nome,
            fluxo: categoria.fluxo,
            emoji: categoria.emoji,
            cor: categoria.cor,
            ordem: categoria.ordem,
          })
          .throwOnError(),
      () => repositorioDemo.salvarCategoria(categoria),
    );
  },
  async removerCategoria(id) {
    await comFila(
      "categorias",
      "delete",
      { id },
      () => cliente().from("categorias").delete().eq("id", id).throwOnError(),
      () => repositorioDemo.removerCategoria(id),
    );
  },

  async movimentacoes(de, ate) {
    const { data, error } = await cliente()
      .from("movimentacoes")
      .select("*")
      .gte("data", de)
      .lte("data", ate)
      .order("data", { ascending: false });
    if (error) {
      if (tabelaAusente(error)) return repositorioDemo.movimentacoes(de, ate);
      throw error;
    }
    return (data ?? []).map(paraMovimentacao);
  },
  async salvarMovimentacao(movimentacao) {
    await comFila(
      "movimentacoes",
      "upsert",
      movimentacao,
      () =>
        cliente()
          .from("movimentacoes")
          .upsert({
            id: movimentacao.id,
            data: movimentacao.data,
            descricao: movimentacao.descricao,
            valor: movimentacao.valor,
            fluxo: movimentacao.fluxo,
            categoria_id: movimentacao.categoriaId || null,
            forma: movimentacao.forma,
            obs: movimentacao.obs,
            criado_em: movimentacao.criadoEm,
          })
          .throwOnError(),
      () => repositorioDemo.salvarMovimentacao(movimentacao),
    );
  },
  async removerMovimentacao(id) {
    await comFila(
      "movimentacoes",
      "delete",
      { id },
      () => cliente().from("movimentacoes").delete().eq("id", id).throwOnError(),
      () => repositorioDemo.removerMovimentacao(id),
    );
  },

  async dias(de, ate) {
    const { data, error } = await cliente().from("dias_venda").select("*").gte("data", de).lte("data", ate).order("data");
    if (error) {
      if (tabelaAusente(error)) return repositorioDemo.dias(de, ate);
      throw error;
    }
    return (data ?? []).map(paraDia);
  },
  async diaPorData(data) {
    const { data: linha, error } = await cliente().from("dias_venda").select("*").eq("data", data).maybeSingle();
    if (error && tabelaAusente(error)) return repositorioDemo.diaPorData(data);
    if (linha) {
      const d = paraDia(linha);
      diasGarantidos.add(d.id);
      return d;
    }
    return null;
  },
  async salvarDia(dia) {
    diasGarantidos.add(dia.id);
    await comFila(
      "dias_venda",
      "upsert",
      dia,
      () =>
        cliente()
          .from("dias_venda")
          .upsert({
            id: dia.id,
            data: dia.data,
            preco_marmita: dia.precoMarmita,
            obs: dia.obs,
            prato: dia.prato ?? "",
            criado_em: dia.criadoEm || new Date().toISOString(),
            fechado_em: dia.fechadoEm ?? null,
          })
          .throwOnError(),
      () => repositorioDemo.salvarDia(dia),
    );
  },

  async abrirDia(data) {
    const existente = await this.diaPorData(data);
    const dia = existente ?? {
      id: `dia_${data}`,
      data,
      precoMarmita: 0,
      obs: "",
      criadoEm: new Date().toISOString(),
    };
    if (!existente) await this.salvarDia(dia);
    const vendas = await this.vendasDoDia(data);
    return { ...vendas, dia };
  },
  async vendasDoDia(data) {
    const dia = (await this.diaPorData(data)) ?? {
      id: `dia_${data}`,
      data,
      precoMarmita: 0,
      obs: "",
      criadoEm: new Date().toISOString(),
    };
    const { data: linhas, error } = await cliente().from("vendas").select("*").eq("dia_id", dia.id).order("ordem");
    if (error) {
      if (tabelaAusente(error)) return repositorioDemo.vendasDoDia(data);
      throw error;
    }
    const vendas = (linhas ?? []).map(paraVenda);
    return { dia, vendas, totais: calcularTotais(vendas, dia.precoMarmita) } satisfies ResumoDia;
  },
  async salvarVendas(vendas) {
    if (!vendas.length) return;
    // Garante que o dia existe em dias_venda antes de gravar as vendas (chave estrangeira dia_id)
    const diaId = vendas[0]?.diaId;
    if (diaId && diaId.startsWith("dia_") && !diasGarantidos.has(diaId)) {
      const dataIso = diaId.slice(4);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
        const diaExistente = await this.diaPorData(dataIso);
        if (!diaExistente) {
          await this.salvarDia({
            id: diaId,
            data: dataIso,
            precoMarmita: 0,
            obs: "",
            criadoEm: new Date().toISOString(),
          });
        }
        diasGarantidos.add(diaId);
      }
    }
    const linhas = vendas.map(linhaVenda);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      for (const linha of linhas) {
        empurrarFila({ id: String(linha.id), tabela: "vendas", acao: "upsert", payload: linha });
      }
      return;
    }
    try {
      await cliente().from("vendas").upsert(linhas).throwOnError();
    } catch (e) {
      if (tabelaAusente(e)) {
        await repositorioDemo.salvarVendas(vendas);
        return;
      }
      throw e;
    }
  },
  async removerVenda(id) {
    await comFila(
      "vendas",
      "delete",
      { id },
      () => cliente().from("vendas").delete().eq("id", id).throwOnError(),
      () => repositorioDemo.removerVenda(id),
    );
  },

  async resumosPeriodo(de, ate) {
    const { data: linhasDia, error } = await cliente()
      .from("dias_venda")
      .select("*")
      .gte("data", de)
      .lte("data", ate)
      .order("data");
    if (error) {
      if (tabelaAusente(error)) return repositorioDemo.resumosPeriodo(de, ate);
      throw error;
    }
    const dias = (linhasDia ?? []).map((l) => paraDia(l));
    if (!dias.length) return [];
    const { data: linhasVenda, error: erroVenda } = await cliente()
      .from("vendas")
      .select("*")
      .in("dia_id", dias.map((d) => d.id));
    if (erroVenda) {
      if (tabelaAusente(erroVenda)) return repositorioDemo.resumosPeriodo(de, ate);
      throw erroVenda;
    }
    const vendas = (linhasVenda ?? []).map((l) => paraVenda(l)).sort((a, b) => a.ordem - b.ordem);
    return dias.map((dia) => {
      const doDia = vendas.filter((v) => v.diaId === dia.id);
      return { dia, vendas: doDia, totais: calcularTotais(doDia, dia.precoMarmita) } satisfies ResumoDia;
    });
  },
  async vendasEmAberto(hoje) {
    const { data: linhasVenda, error } = await cliente()
      .from("vendas")
      .select("*")
      .neq("status", "cancelada");
    if (error) {
      if (tabelaAusente(error)) return repositorioDemo.vendasEmAberto(hoje);
      throw error;
    }
    const vendas = (linhasVenda ?? []).map((l) => paraVenda(l));
    if (!vendas.length) return [];
    const { data: linhasDia, error: erroDia } = await cliente()
      .from("dias_venda")
      .select("*")
      .in("id", [...new Set(vendas.map((v) => v.diaId))]);
    if (erroDia) {
      if (tabelaAusente(erroDia)) return repositorioDemo.vendasEmAberto(hoje);
      throw erroDia;
    }
    const dias = new Map((linhasDia ?? []).map((l) => paraDia(l)).map((d) => [d.id, d]));
    const lista: VendaEmAberto[] = [];
    for (const venda of vendas) {
      const dia = dias.get(venda.diaId);
      if (!dia) continue;
      const valor = faltaReceber(venda, dia.precoMarmita);
      if (valor <= 0) continue;
      lista.push({ venda, dia, valor, diasSemPagar: diasEntre(dia.data, hoje) });
    }
    return lista.sort((a, b) => (a.dia.data === b.dia.data ? b.valor - a.valor : a.dia.data < b.dia.data ? -1 : 1));
  },

  async entregadores() {
    const { data, error } = await cliente().from("entregadores").select("*").order("nome");
    if (error) {
      if (tabelaAusente(error)) return repositorioDemo.entregadores();
      throw error;
    }
    return (data ?? []).map(paraEntregador);
  },
  async salvarEntregador(entregador) {
    await comFila(
      "entregadores",
      "upsert",
      entregador,
      () =>
        cliente()
          .from("entregadores")
          .upsert({
            id: entregador.id,
            nome: entregador.nome,
            telefone: entregador.telefone,
            ativo: entregador.ativo,
          })
          .throwOnError(),
      () => repositorioDemo.salvarEntregador(entregador),
    );
  },
  async removerEntregador(id) {
    await comFila(
      "entregadores",
      "delete",
      { id },
      () => cliente().from("entregadores").delete().eq("id", id).throwOnError(),
      () => repositorioDemo.removerEntregador(id),
    );
  },

  async contas() {
    const { data, error } = await cliente().from("contas").select("*").order("vencimento");
    if (error) {
      if (tabelaAusente(error)) return repositorioDemo.contas();
      throw error;
    }
    return (data ?? []).map(paraConta);
  },
  async salvarContas(contas) {
    const linhas = contas.map(linhaConta);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      for (const linha of linhas) {
        empurrarFila({ id: String(linha.id), tabela: "contas", acao: "upsert", payload: linha });
      }
      return;
    }
    try {
      await cliente().from("contas").upsert(linhas).throwOnError();
    } catch (e) {
      if (tabelaAusente(e)) {
        await repositorioDemo.salvarContas(contas);
        return;
      }
      throw e;
    }
  },
  async removerConta(id) {
    await comFila(
      "contas",
      "delete",
      { id },
      () => cliente().from("contas").delete().eq("id", id).throwOnError(),
      () => repositorioDemo.removerConta(id),
    );
  },
};

export async function despejarFila(): Promise<number> {
  const fila = lerFila();
  if (!fila.length || !db) return 0;
  for (const op of fila) {
    if (op.acao === "delete") await db.from(op.tabela).delete().eq("id", (op.payload as { id: string }).id);
    else await db.from(op.tabela).upsert(op.payload as object);
  }
  limparFila();
  return fila.length;
}
