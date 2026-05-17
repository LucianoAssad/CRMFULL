import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getContasPermitidas } from "@/lib/contas-permitidas";

export interface ContaResumo {
  id: string;
  nome: string;
  tipo_conta: "gerente" | "filha";
  conta_gerente_id: string | null;
  ativo: boolean;
  codigo_publico: string | null;
}

export type ModoSistema = "manager" | "account";

export interface ContextoConta {
  conta_ativa_id: string | null;
  conta_ativa_nome: string | null;
  conta_ativa_tipo: "gerente" | "filha" | null;
  conta_ativa_codigo_publico: string | null;
  modo_sistema: ModoSistema | null;
}

interface ActiveAccountContextValue {
  contas: ContaResumo[];
  contasFilhas: ContaResumo[];
  contasGerentes: ContaResumo[];
  activeContaId: string | null;        // null = "todas as contas filhas"
  activeConta: ContaResumo | null;
  modoSistema: ModoSistema;
  contextoConta: ContextoConta;
  getModoSistema: () => ModoSistema;
  isManagerMode: () => boolean;
  isAccountMode: () => boolean;
  scopedContaIds: string[];            // ids para filtrar consultas
  setActiveContaId: (id: string | null) => void;
  reload: () => Promise<void>;
  loading: boolean;
}

const Ctx = createContext<ActiveAccountContextValue | null>(null);

const STORAGE_KEY = "active_conta_id";

export function ActiveAccountProvider({ children }: { children: ReactNode }) {
  const [contas, setContas] = useState<ContaResumo[]>([]);
  const [activeContaId, setActiveContaIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("empresas")
      .select("id, nome, tipo_conta, conta_gerente_id, ativo, codigo_publico")
      .order("nome");
    // Normalize camelCase API fields (tipoConta → tipo_conta etc.)
    const normalized: ContaResumo[] = ((data as any) || []).map((e: any) => ({
      id: e.id,
      nome: e.nome ?? "",
      tipo_conta: (e.tipo_conta ?? e.tipoConta ?? "filha") as "gerente" | "filha",
      conta_gerente_id: e.conta_gerente_id ?? e.contaGerenteId ?? null,
      ativo: e.ativo ?? true,
      codigo_publico: e.codigo_publico ?? e.codigoPublico ?? null,
    }));
    setContas(normalized);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const setActiveContaId = (id: string | null) => {
    setActiveContaIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  };

  const contasFilhas = contas.filter((c) => c.tipo_conta === "filha");
  const contasGerentes = contas.filter((c) => c.tipo_conta === "gerente");

  const activeConta = contas.find((c) => c.id === activeContaId) ?? null;
  const modoSistema: ModoSistema = activeConta?.tipo_conta === "gerente" ? "manager" : "account";

  // Escopo estrito por hierarquia da conta ativa (helper centralizado).
  // - Sem conta ativa: vazio (telas devem pedir para selecionar)
  // - Conta filha: somente ela mesma
  // - Conta gerente: ela mesma + descendentes (filhas e sub-gerentes recursivamente)
  const scopedContaIds = getContasPermitidas(activeContaId, contas);
  const getModoSistema = () => modoSistema;
  const isManagerMode = () => modoSistema === "manager";
  const isAccountMode = () => modoSistema === "account";

  const contextoConta: ContextoConta = {
    conta_ativa_id: activeConta?.id ?? null,
    conta_ativa_nome: activeConta?.nome ?? null,
    conta_ativa_tipo: activeConta?.tipo_conta ?? null,
    conta_ativa_codigo_publico: activeConta?.codigo_publico ?? null,
    modo_sistema: activeConta ? modoSistema : null,
  };

  // Mirror para acesso fora de componentes React
  globalModoSistema = modoSistema;
  globalActiveConta = activeConta;
  globalContextoConta = contextoConta;

  return (
    <Ctx.Provider value={{
      contas, contasFilhas, contasGerentes,
      activeContaId, activeConta, modoSistema, contextoConta,
      getModoSistema, isManagerMode, isAccountMode,
      scopedContaIds,
      setActiveContaId, reload, loading,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useActiveAccount() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActiveAccount must be used within ActiveAccountProvider");
  return ctx;
}

// ===== Acesso global (fora de componentes React) =====
let globalModoSistema: ModoSistema = "account";
let globalActiveConta: ContaResumo | null = null;
let globalContextoConta: ContextoConta = {
  conta_ativa_id: null,
  conta_ativa_nome: null,
  conta_ativa_tipo: null,
  conta_ativa_codigo_publico: null,
  modo_sistema: null,
};

export function getModoSistema(): ModoSistema {
  return globalModoSistema;
}

export function isManagerMode(): boolean {
  return globalModoSistema === "manager";
}

export function isAccountMode(): boolean {
  return globalModoSistema === "account";
}

export function getActiveConta(): ContaResumo | null {
  return globalActiveConta;
}

export function getContextoConta(): ContextoConta {
  return globalContextoConta;
}
