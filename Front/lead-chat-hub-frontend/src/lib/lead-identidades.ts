import { supabase } from "@/integrations/supabase/client";

export type IdentidadeTipo =
  | "telefone"
  | "whatsapp"
  | "email"
  | "instagram"
  | "messenger"
  | "telegram"
  | "tiktok"
  | "webchat_id"
  | "outro";

export interface LeadIdentidade {
  id: string;
  empresa_id: string;
  lead_id: string;
  tipo: IdentidadeTipo;
  valor: string;
  canal: string | null;
  provider: string | null;
  principal: boolean;
  verificado: boolean;
  origem: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export const IDENTIDADE_LABEL: Record<IdentidadeTipo, string> = {
  telefone: "Telefone",
  whatsapp: "WhatsApp",
  email: "Email",
  instagram: "Instagram",
  messenger: "Messenger",
  telegram: "Telegram",
  tiktok: "TikTok",
  webchat_id: "Webchat ID",
  outro: "Outro",
};

export const IDENTIDADE_BADGE_CLASS: Record<IdentidadeTipo, string> = {
  telefone: "bg-info/15 text-info border-info/30",
  whatsapp: "bg-success/15 text-success border-success/30",
  email: "bg-primary/15 text-primary border-primary/30",
  instagram: "bg-destructive/15 text-destructive border-destructive/30",
  messenger: "bg-info/15 text-info border-info/30",
  telegram: "bg-info/15 text-info border-info/30",
  tiktok: "bg-foreground/10 text-foreground border-border",
  webchat_id: "bg-warning/15 text-warning border-warning/30",
  outro: "bg-muted text-muted-foreground border-border",
};

const normTelefone = (v: string) => v.replace(/\s+/g, "").trim();
const normEmail = (v: string) => v.trim().toLowerCase();

export function normalizarValor(tipo: IdentidadeTipo, valor: string): string {
  if (!valor) return "";
  if (tipo === "email") return normEmail(valor);
  if (tipo === "telefone" || tipo === "whatsapp") return normTelefone(valor);
  return valor.trim();
}

async function upsertIdentidade(params: {
  empresaId: string;
  leadId: string;
  tipo: IdentidadeTipo;
  valor: string;
  canal?: string | null;
  origem?: string | null;
}) {
  const valor = normalizarValor(params.tipo, params.valor);
  if (!valor) return;
  // Verificar duplicidade na mesma empresa/tipo/valor
  const { data: existente } = await supabase
    .from("lead_identidades")
    .select("id, lead_id")
    .eq("empresa_id", params.empresaId)
    .eq("tipo", params.tipo)
    .ilike("valor", valor)
    .maybeSingle();
  if (existente) return; // já existe, não duplicar
  await supabase.from("lead_identidades").insert({
    empresa_id: params.empresaId,
    lead_id: params.leadId,
    tipo: params.tipo,
    valor,
    canal: params.canal ?? null,
    origem: params.origem ?? null,
  } as any);
}

/**
 * Garante que o lead tenha identidades correspondentes ao telefone/email/WhatsApp informados.
 * Não duplica identidades existentes. Não apaga identidades antigas.
 */
export async function syncLeadIdentidades(opts: {
  empresaId: string;
  leadId: string;
  telefone?: string | null;
  email?: string | null;
  origem?: string | null;
  canalTipo?: string | null; // tipo do canal da conversa, se houver
}) {
  if (!opts.empresaId || !opts.leadId) return;
  const tasks: Promise<any>[] = [];
  if (opts.telefone && opts.telefone.trim()) {
    tasks.push(
      upsertIdentidade({
        empresaId: opts.empresaId,
        leadId: opts.leadId,
        tipo: "telefone",
        valor: opts.telefone,
        origem: opts.origem ?? null,
      })
    );
  }
  if (opts.email && opts.email.trim()) {
    tasks.push(
      upsertIdentidade({
        empresaId: opts.empresaId,
        leadId: opts.leadId,
        tipo: "email",
        valor: opts.email,
        origem: opts.origem ?? null,
      })
    );
  }
  const isWA =
    (opts.canalTipo || "").toLowerCase().includes("whatsapp") ||
    (opts.origem || "").toLowerCase().includes("whatsapp");
  if (isWA && opts.telefone && opts.telefone.trim()) {
    tasks.push(
      upsertIdentidade({
        empresaId: opts.empresaId,
        leadId: opts.leadId,
        tipo: "whatsapp",
        valor: opts.telefone,
        canal: "whatsapp",
        origem: opts.origem ?? null,
      })
    );
  }
  await Promise.all(tasks);
}

export async function listarIdentidadesPorEmpresa(empresaId: string): Promise<LeadIdentidade[]> {
  if (!empresaId) return [];
  const { data } = await supabase
    .from("lead_identidades")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("principal", { ascending: false })
    .order("created_at", { ascending: true });
  return (data as any) || [];
}

export async function listarIdentidadesDoLead(leadId: string, empresaId: string): Promise<LeadIdentidade[]> {
  if (!leadId || !empresaId) return [];
  const { data } = await supabase
    .from("lead_identidades")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("lead_id", leadId)
    .order("principal", { ascending: false })
    .order("created_at", { ascending: true });
  return (data as any) || [];
}
