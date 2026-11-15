// Aplica supabase/schema.sql no projeto via pooler do Supabase.
// Uso: SUPABASE_DB_PASSWORD=xxx node scripts/apply-schema.mjs
// A senha nunca fica no arquivo — vem da variável de ambiente.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ref = process.env.SUPABASE_REF ?? "ysybvdejltyjcxcihicu";
const senha = process.env.SUPABASE_DB_PASSWORD;
if (!senha) {
  console.error("defina SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const regioes = [
  "aws-0-sa-east-1",
  "aws-0-us-east-1",
  "aws-0-us-east-2",
  "aws-0-us-west-1",
  "aws-0-eu-central-1",
  "aws-0-eu-west-1",
  "aws-0-ap-southeast-1",
];
const sql = readFileSync(fileURLToPath(new URL("../supabase/schema.sql", import.meta.url)), "utf8");

let conectado = null;
for (const regiao of regioes) {
  const cliente = new pg.Client({
    host: `${regiao}.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${ref}`,
    password: senha,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await cliente.connect();
    console.log(`conectado em ${regiao}`);
    conectado = cliente;
    break;
  } catch (erro) {
    console.log(`× ${regiao}: ${erro.code ?? erro.message}`);
    await cliente.end().catch(() => {});
  }
}

if (!conectado) {
  console.error("nenhuma região respondeu");
  process.exit(1);
}

await conectado.query(sql);
const tabelas = await conectado.query(
  "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
);
console.log("tabelas:", tabelas.rows.map((r) => r.table_name).join(", "));
const colunas = await conectado.query(
  "select column_name from information_schema.columns where table_schema='public' and table_name='vendas' order by ordinal_position",
);
console.log("vendas:", colunas.rows.map((c) => c.column_name).join(", "));
await conectado.end();
