import type {
  Categoria,
  Conta,
  DiaVenda,
  Entregador,
  Movimentacao,
  ResumoDia,
  StatusVenda,
  Usuario,
  Venda,
  VendaEmAberto,
} from "@/domain/types";
import { calcularTotais, faltaReceber, idMovimentacaoPagamento, valorLinha } from "@/domain/totais";
import { gerarParcelas } from "@/domain/contas";
import { diasEntre, paraISO } from "@/shared/lib/format";
import { gravarBanco, lerBanco } from "@/shared/lib/storage";
import type { Repositorio } from "./repositorio";

interface Banco {
  usuarios: Usuario[];
  categorias: Categoria[];
  movimentacoes: Movimentacao[];
  dias: DiaVenda[];
  vendas: Venda[];
  entregadores: Entregador[];
  contas: Conta[];
}

const NOMES = [
  "Laura", "Ludmila", "Pastora Cida", "Luza", "Naiara", "Senhorinha", "Rodrigo", "Iago",
  "Menesa", "Nilza", "Fabrício", "Paula", "Deusa", "Gessy", "Pedro/Ronaldo", "Ulisses/Ronaldo",
  "Fernanda", "Marilene", "Jean", "Mequias", "Carmelicia", "Sumaia", "Audiceia", "Roberto",
  "Cristiane", "Gledson", "Adélia", "Tiago Mesquita", "Fran", "Eliane", "Carla", "Diogo",
  "Flávio", "Douglas", "Uelton", "Franciele", "Sarah",
];

const PG = new Set(["Paula", "Pedro/Ronaldo", "Ulisses/Ronaldo", "Marilene", "Carmelicia", "Cristiane", "Carla"]);

function agora(): string {
  return new Date().toISOString();
}

function isoHá(dias: number): string {
  return paraISO(new Date(Date.now() - dias * 86_400_000));
}

function isoEm(dias: number): string {
  return isoHá(-dias);
}

const PRATOS = [
  "Frango assado com batata",
  "Bife acebolado com arroz e feijão",
  "Escondidinho de carne seca",
  "Frango com quiabo e purê",
  "Strogonoff de frango",
  "Costela com mandioca",
  "Galinhada",
  "Feijoada",
  "Macarrão à bolonhesa",
  "Filé de peixe com legumes",
];

/** Compras no crédito e parcelamentos, para a tela Contas não abrir vazia no primeiro uso. */
function criarContasSeed(): Conta[] {
  return [
    {
      id: "con_energia",
      descricao: "Conta de energia",
      fornecedor: "Cemig",
      valor: 180.4,
      vencimento: isoEm(5),
      categoriaId: "cat_energia",
      forma: "pix",
      paga: false,
      pagoEm: null,
      grupo: null,
      parcela: null,
      parcelas: null,
      obs: "",
    },
    {
      id: "con_agua",
      descricao: "Conta de água",
      fornecedor: "Copasa",
      valor: 76.9,
      vencimento: isoEm(-2),
      categoriaId: "cat_agua",
      forma: "dinheiro",
      paga: false,
      pagoEm: null,
      grupo: null,
      parcela: null,
      parcelas: null,
      obs: "veio com a taxa de esgoto",
    },
    {
      id: "con_gasolina",
      descricao: "Gasolina da semana",
      fornecedor: "Posto São Jorge",
      valor: 220,
      vencimento: isoEm(0),
      categoriaId: "cat_gasolina",
      forma: "cartao",
      paga: false,
      pagoEm: null,
      grupo: null,
      parcela: null,
      parcelas: null,
      obs: "",
    },
    ...gerarParcelas(
      {
        descricao: "Freezer horizontal",
        fornecedor: "Eletro Marmita",
        categoriaId: "cat_outro_s",
        forma: "cartao",
        primeiraVencimento: isoEm(-55),
      },
      1450,
      10,
      "mes",
    ).map((c, i) => ({ ...c, paga: i < 2, pagoEm: i < 2 ? c.vencimento : null })),
    ...gerarParcelas(
      {
        descricao: "Recarga de gás",
        fornecedor: "Gás BH",
        categoriaId: "cat_gas",
        forma: "dinheiro",
        primeiraVencimento: isoEm(2),
      },
      440,
      4,
      "quinzena",
    ),
  ];
}

function criarSeed(): Banco {
  const categorias: Categoria[] = [
    { id: "cat_venda", nome: "Venda de marmita", fluxo: "entrada", emoji: "🍱", cor: "text-entregue", ordem: 1 },
    { id: "cat_outro_e", nome: "Outro", fluxo: "entrada", emoji: "💰", cor: "text-entregue", ordem: 2 },
    { id: "cat_mercado", nome: "Mercado", fluxo: "saida", emoji: "🛒", cor: "text-saida", ordem: 1 },
    { id: "cat_gas", nome: "Gás", fluxo: "saida", emoji: "🔥", cor: "text-saida", ordem: 2 },
    { id: "cat_carne", nome: "Carne", fluxo: "saida", emoji: "🥩", cor: "text-saida", ordem: 3 },
    { id: "cat_arroz", nome: "Arroz e feijão", fluxo: "saida", emoji: "🍚", cor: "text-saida", ordem: 4 },
    { id: "cat_embalagem", nome: "Embalagem", fluxo: "saida", emoji: "📦", cor: "text-saida", ordem: 5 },
    { id: "cat_energia", nome: "Energia", fluxo: "saida", emoji: "⚡", cor: "text-saida", ordem: 6 },
    { id: "cat_agua", nome: "Água", fluxo: "saida", emoji: "💧", cor: "text-saida", ordem: 7 },
    { id: "cat_gasolina", nome: "Gasolina", fluxo: "saida", emoji: "⛽", cor: "text-saida", ordem: 8 },
    { id: "cat_limpeza", nome: "Limpeza", fluxo: "saida", emoji: "🧽", cor: "text-saida", ordem: 9 },
    { id: "cat_outro_s", nome: "Outro", fluxo: "saida", emoji: "🧾", cor: "text-saida", ordem: 10 },
  ];

  const usuarios: Usuario[] = [
    { id: "usr_marcia", nome: "Márcia", email: "marcia@marmitaria.com", papel: "adm", ativo: true, criadoEm: isoHá(120), ultimoAcesso: agora() },
    { id: "usr_cozinha", nome: "Ajuda da cozinha", email: "cozinha@marmitaria.com", papel: "cozinha", ativo: true, criadoEm: isoHá(40), ultimoAcesso: isoHá(1) },
    { id: "usr_entrega", nome: "Rota de entrega", email: "entrega@marmitaria.com", papel: "entregador", ativo: true, criadoEm: isoHá(25), ultimoAcesso: isoHá(2) },
  ];

  const entregadores: Entregador[] = [
    { id: "ent_carlos", nome: "Carlos", telefone: "(31) 99911-2233", ativo: true },
    { id: "ent_rafael", nome: "Rafael", telefone: "(31) 99922-3344", ativo: true },
    { id: "ent_ju", nome: "Juliana", telefone: "(31) 99933-4455", ativo: true },
  ];

  const dias: DiaVenda[] = [];
  const vendas: Venda[] = [];
  const movimentacoes: Movimentacao[] = [];

  // Histórico dos últimos 9 dias (ontem para trás), com queda e subida natural.
  for (let i = 9; i >= 1; i--) {
    const data = isoHá(i);
    const preco = i % 7 === 0 ? 15 : 14;
    const dia: DiaVenda = {
      id: `dia_${data}`,
      data,
      precoMarmita: preco,
      obs: i === 7 ? "Dia da feira" : "",
      prato: PRATOS[i % PRATOS.length],
      criadoEm: isoHá(i),
      fechadoEm: data,
    };
    dias.push(dia);

    const total = 22 + ((i * 7) % 14);
    for (let n = 0; n < total; n++) {
      const nome = NOMES[(n + i) % NOMES.length];
      const qtd = (n * 3 + i) % 5 === 0 ? 2 : 1;
      vendas.push({
        id: `ven_${dia.id}_${n}`,
        diaId: dia.id,
        cliente: nome,
        qtd,
        pg: PG.has(nome) && (n + i) % 3 === 0,
        paga: !(PG.has(nome) && (n + i) % 3 === 0),
        entreguePor: entregadores[(n + i) % entregadores.length].id,
        status: "entregue",
        obs: "",
        ordem: n,
        valorUnit: null,
        acrescimo: 0,
        valorPago: null,
      });
    }

    const marmitas = vendas.filter((v) => v.diaId === dia.id).reduce((s, v) => s + v.qtd, 0);
    movimentacoes.push({
      id: `mov_e_${data}`,
      data,
      descricao: "Vendas do dia",
      valor: Math.round(marmitas * preco * 0.82 * 100) / 100,
      fluxo: "entrada",
      categoriaId: "cat_venda",
      forma: "dinheiro",
      obs: "",
      criadoEm: isoHá(i),
    });
    movimentacoes.push({
      id: `mov_m_${data}`,
      data,
      descricao: i % 3 === 0 ? "Carne e frango" : "Mercado",
      valor: 90 + ((i * 37) % 130),
      fluxo: "saida",
      categoriaId: i % 3 === 0 ? "cat_carne" : "cat_mercado",
      forma: i % 4 === 0 ? "cartao" : "dinheiro",
      obs: "",
      criadoEm: isoHá(i),
    });
    if (i % 5 === 0) {
      movimentacoes.push({
        id: `mov_g_${data}`,
        data,
        descricao: "Gás",
        valor: 110,
        fluxo: "saida",
        categoriaId: "cat_gas",
        forma: "pix",
        obs: "",
        criadoEm: isoHá(i),
      });
    }
  }

  // Hoje: metade já lançada, para a colagem em lote mostrar novo / ajustar / igual.
  const hoje = isoHá(0);
  const precoHoje = 14;
  const diaHoje: DiaVenda = {
    id: `dia_${hoje}`,
    data: hoje,
    precoMarmita: precoHoje,
    obs: "",
    prato: "Frango assado com batata e arroz",
    criadoEm: agora(),
  };
  dias.push(diaHoje);

  const meia: [string, number, StatusVenda][] = [
    ["Laura", 2, "entregue"],
    ["Ludmila", 1, "entregue"],
    ["Pastora Cida", 1, "preparada"],
    ["Rodrigo", 3, "preparada"],
    ["Iago", 2, "pendente"],
    ["Nilza", 2, "pendente"],
    ["Jean", 4, "pendente"],
    ["Mequias", 5, "pendente"],
  ];
  meia.forEach(([cliente, qtd, status], n) => {
    const id = `ven_${diaHoje.id}_${n}`;
    const paga = status === "entregue";
    const venda: Venda = {
      id,
      diaId: diaHoje.id,
      cliente,
      qtd,
      pg: PG.has(cliente),
      paga,
      entreguePor: status === "entregue" ? entregadores[n % entregadores.length].id : null,
      status,
      obs: "",
      ordem: n,
      valorUnit: null,
      acrescimo: 0,
      valorPago: null,
    };
    vendas.push(venda);
    if (paga) {
      movimentacoes.push({
        id: idMovimentacaoPagamento(id),
        data: hoje,
        descricao: `Marmitas ${cliente}`,
        valor: valorLinha(venda, precoHoje),
        fluxo: "entrada",
        categoriaId: "cat_venda",
        forma: "pix",
        obs: "",
        criadoEm: agora(),
      });
    }
  });

  movimentacoes.push({
    id: `mov_hoje_mercado`,
    data: hoje,
    descricao: "Hortifruti",
    valor: 76.9,
    fluxo: "saida",
    categoriaId: "cat_mercado",
    forma: "pix",
    obs: "",
    criadoEm: agora(),
  });

  const contas = criarContasSeed();

  return { usuarios, categorias, movimentacoes, dias, vendas, entregadores, contas };
}

let cache: Banco | null = null;

/** Banco salvo antes das colunas de preço por linha: completa o que falta. */
function completarVendas(b: Banco): Banco {
  b.vendas = b.vendas.map((v) => ({
    ...v,
    valorUnit: v.valorUnit ?? null,
    acrescimo: v.acrescimo ?? 0,
    valorPago: v.valorPago ?? null,
  }));
  // sem a lista = banco antigo, criado antes das contas; lista vazia é escolha dele.
  if (!Array.isArray(b.contas)) b.contas = criarContasSeed();
  return b;
}

function banco(): Banco {
  if (!cache) cache = completarVendas(lerBanco<Banco>(criarSeed));
  return cache;
}

function salvar(): void {
  gravarBanco(banco());
}

function ordenar(vendas: Venda[]): Venda[] {
  return [...vendas].sort((a, b) => a.ordem - b.ordem || a.cliente.localeCompare(b.cliente, "pt-BR"));
}

function comDia(b: Banco, dia: DiaVenda): ResumoDia {
  const vendas = ordenar(b.vendas.filter((v) => v.diaId === dia.id));
  return { dia, vendas, totais: calcularTotais(vendas, dia.precoMarmita) };
}

function resumo(data: string): ResumoDia {
  const b = banco();
  const dia = b.dias.find((d) => d.data === data) ?? { id: `dia_${data}`, data, precoMarmita: 0, obs: "", criadoEm: new Date().toISOString() };
  return comDia(b, dia);
}

export const repositorioDemo: Repositorio = {
  async usuarios() {
    return [...banco().usuarios];
  },
  async salvarUsuario(usuario) {
    const b = banco();
    const i = b.usuarios.findIndex((u) => u.id === usuario.id);
    if (i >= 0) b.usuarios[i] = usuario;
    else b.usuarios.push(usuario);
    salvar();
  },
  async removerUsuario(id) {
    const b = banco();
    b.usuarios = b.usuarios.filter((u) => u.id !== id);
    salvar();
  },

  async categorias() {
    return [...banco().categorias].sort((a, b) => a.fluxo.localeCompare(b.fluxo) || a.ordem - b.ordem);
  },
  async salvarCategoria(categoria) {
    const b = banco();
    const i = b.categorias.findIndex((c) => c.id === categoria.id);
    if (i >= 0) b.categorias[i] = categoria;
    else b.categorias.push(categoria);
    salvar();
  },
  async removerCategoria(id) {
    const b = banco();
    b.categorias = b.categorias.filter((c) => c.id !== id);
    salvar();
  },

  async movimentacoes(de, ate) {
    return banco()
      .movimentacoes.filter((m) => m.data >= de && m.data <= ate)
      .sort((a, b) => (a.data === b.data ? a.criadoEm.localeCompare(b.criadoEm) : a.data < b.data ? 1 : -1));
  },
  async salvarMovimentacao(movimentacao) {
    const b = banco();
    const i = b.movimentacoes.findIndex((m) => m.id === movimentacao.id);
    if (i >= 0) b.movimentacoes[i] = movimentacao;
    else b.movimentacoes.push(movimentacao);
    salvar();
  },
  async removerMovimentacao(id) {
    const b = banco();
    b.movimentacoes = b.movimentacoes.filter((m) => m.id !== id);
    salvar();
  },

  async dias(de, ate) {
    return banco().dias.filter((d) => d.data >= de && d.data <= ate).sort((a, b) => (a.data < b.data ? -1 : 1));
  },
  async diaPorData(data) {
    return banco().dias.find((d) => d.data === data) ?? null;
  },
  async salvarDia(dia) {
    const b = banco();
    const i = b.dias.findIndex((d) => d.id === dia.id);
    if (i >= 0) b.dias[i] = dia;
    else b.dias.push(dia);
    salvar();
  },

  async abrirDia(data) {
    const b = banco();
    if (!b.dias.some((d) => d.data === data)) {
      const anterior = b.dias.filter((d) => d.data < data).sort((x, y) => (x.data < y.data ? 1 : -1))[0];
      b.dias.push({
        id: `dia_${data}`,
        data,
        precoMarmita: anterior?.precoMarmita ?? 0,
        obs: "",
        criadoEm: new Date().toISOString(),
      });
      salvar();
    }
    return resumo(data);
  },
  async vendasDoDia(data) {
    return resumo(data);
  },
  async salvarVendas(vendas) {
    const b = banco();
    let maxOrdem = Math.max(0, ...b.vendas.map((v) => v.ordem));
    for (const venda of vendas) {
      const i = b.vendas.findIndex((v) => v.id === venda.id);
      if (i >= 0) b.vendas[i] = { ...venda };
      else b.vendas.push({ ...venda, ordem: ++maxOrdem });
    }
    salvar();
  },
  async removerVenda(id) {
    const b = banco();
    b.vendas = b.vendas.filter((v) => v.id !== id);
    salvar();
  },

  async resumosPeriodo(de, ate) {
    const b = banco();
    return b.dias
      .filter((d) => d.data >= de && d.data <= ate)
      .sort((a, b) => (a.data < b.data ? -1 : 1))
      .map((d) => comDia(b, d));
  },
  async vendasEmAberto(hoje) {
    const b = banco();
    const lista: VendaEmAberto[] = [];
    for (const v of b.vendas) {
      const dia = b.dias.find((d) => d.id === v.diaId);
      if (!dia) continue;
      // faltaReceber já corta cancelada e linha paga por inteiro; sobra só o parcial.
      const valor = faltaReceber(v, dia.precoMarmita);
      if (valor <= 0) continue;
      lista.push({ venda: v, dia, valor, diasSemPagar: diasEntre(dia.data, hoje) });
    }
    return lista.sort((a, b) => (a.dia.data === b.dia.data ? b.valor - a.valor : a.dia.data < b.dia.data ? -1 : 1));
  },

  async entregadores() {
    return [...banco().entregadores].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  },
  async salvarEntregador(entregador) {
    const b = banco();
    const i = b.entregadores.findIndex((e) => e.id === entregador.id);
    if (i >= 0) b.entregadores[i] = entregador;
    else b.entregadores.push(entregador);
    salvar();
  },
  async removerEntregador(id) {
    const b = banco();
    b.entregadores = b.entregadores.filter((e) => e.id !== id);
    salvar();
  },

  async contas() {
    return [...banco().contas].sort((a, b) => (a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1 : 0));
  },
  async salvarContas(contas) {
    const b = banco();
    for (const conta of contas) {
      const i = b.contas.findIndex((c) => c.id === conta.id);
      if (i >= 0) b.contas[i] = { ...conta };
      else b.contas.push({ ...conta });
    }
    salvar();
  },
  async removerConta(id) {
    const b = banco();
    b.contas = b.contas.filter((c) => c.id !== id);
    salvar();
  },
};
