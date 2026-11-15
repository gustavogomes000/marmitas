import { create } from "zustand";
import type { Papel, Usuario } from "@/domain/types";
import { repo } from "@/data";
import { repositorioDemo } from "@/data/demo";
import { db } from "@/shared/lib/supabase";

const CHAVE = "marmitaria.sessao.v1";

export interface Sessao {
  usuarioId: string;
  nome: string;
  email: string;
  papel: Papel;
}

export const SESSAO_PADRAO: Sessao = {
  usuarioId: "usr_marcia",
  nome: "Márcia",
  email: "marcia@marmitaria.com",
  papel: "adm",
};

interface EstadoSessao {
  sessao: Sessao | null;
  carregando: boolean;
  erro: string | null;
  entrar: (email: string, senha: string, lembrar: boolean) => Promise<void>;
  entrarRapido: (usuarioId: string, lembrar: boolean) => Promise<void>;
  sair: () => void;
  restaurar: () => void;
}

function gravar(sessao: Sessao | null, lembrar: boolean) {
  const bruto = sessao ? JSON.stringify(sessao) : null;
  if (lembrar) {
    if (bruto) localStorage.setItem(CHAVE, bruto);
    else localStorage.removeItem(CHAVE);
  }
  if (!lembrar || !sessao) sessionStorage.removeItem(CHAVE);
  if (!lembrar && sessao) sessionStorage.setItem(CHAVE, bruto ?? "");
}

function lerGravado(): { sessao: Sessao; lembrar: boolean } | null {
  try {
    const persistente = localStorage.getItem(CHAVE);
    if (persistente) return { sessao: JSON.parse(persistente) as Sessao, lembrar: true };
    const temporaria = sessionStorage.getItem(CHAVE);
    if (temporaria) return { sessao: JSON.parse(temporaria) as Sessao, lembrar: false };
  } catch {
    localStorage.removeItem(CHAVE);
    sessionStorage.removeItem(CHAVE);
  }
  return null;
}

async function obterUsuariosComFallback(): Promise<Usuario[]> {
  try {
    const lista = await repo.usuarios();
    if (lista.length > 0) return lista;
    return await repositorioDemo.usuarios();
  } catch {
    return await repositorioDemo.usuarios();
  }
}

async function carregarPerfilPorIdentificador(idOuEmail: string): Promise<Sessao> {
  const usuarios = await obterUsuariosComFallback();
  const alvo = idOuEmail.trim().toLowerCase();
  const encontrado = usuarios.find(
    (u) => u.id.toLowerCase() === alvo || u.email.trim().toLowerCase() === alvo,
  );
  if (!encontrado) throw new Error("Email ou senha não conferem");
  if (!encontrado.ativo) throw new Error("Acesso desativado. Fale com a Márcia.");

  // Registra o último acesso no banco sem bloquear o login
  const atualizado: Usuario = { ...encontrado, ultimoAcesso: new Date().toISOString() };
  void repo.salvarUsuario(atualizado).catch(() => {});

  return {
    usuarioId: encontrado.id,
    nome: encontrado.nome,
    email: encontrado.email,
    papel: encontrado.papel,
  };
}

export const useSessao = create<EstadoSessao>((set) => ({
  sessao: lerGravado()?.sessao ?? SESSAO_PADRAO,
  carregando: false,
  erro: null,

  restaurar() {
    const gravado = lerGravado();
    if (gravado) {
      set({ sessao: gravado.sessao });
    } else {
      gravar(SESSAO_PADRAO, true);
      set({ sessao: SESSAO_PADRAO });
    }
  },

  async entrar(email, senha, lembrar) {
    const emailLimpo = email.trim().toLowerCase();
    if (!emailLimpo) {
      set({ erro: "Digite seu email para entrar" });
      return;
    }
    if (senha.trim().length < 4) {
      set({ erro: "A senha precisa ter ao menos 4 caracteres" });
      return;
    }

    set({ carregando: true, erro: null });
    try {
      if (db) {
        const { data: authData, error: authErr } = await db.auth.signInWithPassword({
          email: emailLimpo,
          password: senha,
        });

        if (!authErr && authData.user) {
          try {
            const sessao = await carregarPerfilPorIdentificador(authData.user.email ?? authData.user.id);
            gravar(sessao, lembrar);
            set({ sessao, carregando: false });
            return;
          } catch {
            // Se o usuário existe no Supabase Auth mas ainda não tinha linha em perfis, cria automaticamente
            const nomePadrao = (authData.user.user_metadata?.nome as string | undefined) || emailLimpo.split("@")[0] || "Equipe";
            const papelPadrao = (authData.user.user_metadata?.papel as Papel | undefined) || "adm";
            const novoUsuario: Usuario = {
              id: `usr_${authData.user.id.slice(0, 8)}`,
              nome: nomePadrao,
              email: emailLimpo,
              papel: papelPadrao,
              ativo: true,
              criadoEm: new Date().toISOString(),
              ultimoAcesso: new Date().toISOString(),
            };
            await repo.salvarUsuario(novoUsuario).catch(() => {});
            const sessao: Sessao = {
              usuarioId: novoUsuario.id,
              nome: novoUsuario.nome,
              email: novoUsuario.email,
              papel: novoUsuario.papel,
            };
            gravar(sessao, lembrar);
            set({ sessao, carregando: false });
            return;
          }
        }
      }

      // Validação direta na tabela perfis do banco (ou fallback local se schema ainda não rodou)
      const sessao = await carregarPerfilPorIdentificador(emailLimpo);
      gravar(sessao, lembrar);
      set({ sessao, carregando: false });
    } catch (e) {
      set({
        carregando: false,
        erro: e instanceof Error ? e.message : "Não foi possível entrar, tente novamente",
      });
    }
  },

  async entrarRapido(usuarioId, lembrar) {
    set({ carregando: true, erro: null });
    try {
      const sessao = await carregarPerfilPorIdentificador(usuarioId);
      gravar(sessao, lembrar);
      set({ sessao, carregando: false });
    } catch (e) {
      set({ carregando: false, erro: e instanceof Error ? e.message : "Não entrou" });
    }
  },

  sair() {
    gravar(SESSAO_PADRAO, true);
    if (db) void db.auth.signOut();
    set({ sessao: SESSAO_PADRAO, erro: null });
  },
}));

export function ehAdm(papel?: Papel | null): boolean {
  return papel === "adm";
}
