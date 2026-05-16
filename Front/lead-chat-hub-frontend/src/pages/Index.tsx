import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { captureTrackingFromUrl } from "@/lib/tracking";
import { ConversationList } from "@/components/crm/ConversationList";
import { ChatPanel } from "@/components/crm/ChatPanel";
import { LeadPanel } from "@/components/crm/LeadPanel";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";

import type { Canal, Conversa, Lead, Mensagem } from "@/lib/crm-types";
import { toast } from "sonner";

export default function Index() {
  const { scopedContaIds, activeContaId, contas } = useActiveAccount();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [canalContas, setCanalContas] = useState<Record<string, string[]>>({}); // canal_id -> [conta_filha_id]
  const [selected, setSelected] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [lead, setLead] = useState<Lead | null>(null);

  const loadCanais = async () => {
    let q = supabase.from("canais_conectados").select("*").eq("ativo", true);
    if (scopedContaIds.length > 0) q = q.in("empresa_id", scopedContaIds);
    const { data } = await q;
    const list: Canal[] = (data as any) || [];
    setCanais(list);
    // carrega vínculos canal -> contas filhas ativas
    if (list.length === 0) { setCanalContas({}); return; }
    const { data: links } = await supabase
      .from("canal_contas" as any)
      .select("canal_conectado_id, conta_filha_id, ativo")
      .in("canal_conectado_id", list.map((c) => c.id));
    const map: Record<string, string[]> = {};
    for (const l of (links as any) || []) {
      if (!l.ativo) continue;
      (map[l.canal_conectado_id] ||= []).push(l.conta_filha_id);
    }
    setCanalContas(map);
  };

  const loadConversas = async () => {
    let q = supabase
      .from("conversas")
      .select("*, lead:leads(*), canal:canais_conectados(*)")
      .order("ultima_mensagem_em", { ascending: false });
    if (scopedContaIds.length > 0) q = q.in("empresa_id", scopedContaIds);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    const list = ((data as any) || []).sort((a: any, b: any) => {
      const ap = a.conta_filha_pendente ? 1 : 0;
      const bp = b.conta_filha_pendente ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return (b.lead?.score ?? 0) - (a.lead?.score ?? 0);
    });
    setConversas(list);
  };

  useEffect(() => { captureTrackingFromUrl(); loadConversas(); loadCanais(); /* eslint-disable-next-line */ }, [activeContaId, scopedContaIds.join(",")]);

  useEffect(() => {
    const ch = supabase
      .channel("crm")
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens" }, () => {
        if (selected) loadMensagens(selected.id);
        loadConversas();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversas" }, () => loadConversas())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selected]);

  const loadMensagens = async (convId: string) => {
    const { data, error } = await supabase
      .from("mensagens")
      .select("*")
      .eq("conversa_id", convId)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setMensagens((data as any) || []);
  };

  const openConversa = async (c: Conversa) => {
    setSelected(c);
    setLead(c.lead || null);
    await loadMensagens(c.id);
    if (c.nao_lidas > 0) {
      await supabase.from("conversas").update({ nao_lidas: 0 }).eq("id", c.id);
    }
  };

  const sendMessage = async (text: string) => {
    if (!selected) return;
    const { error } = await supabase.from("mensagens").insert({
      conversa_id: selected.id,
      direcao: "outbound",
      conteudo: text,
      autor: "Atendente",
      lida: true,
    });
    if (error) toast.error(error.message);
    // Trigger atualizar_conversa_apos_mensagem already updates ultima_mensagem/updated_at
  };

  const sendTemplate = async ({ template_id, nome_externo, idioma, variaveis }: { template_id: string; nome_externo: string; idioma: string; variaveis: string[] }) => {
    if (!selected) return;
    const isWhatsapp = selected.canal?.tipo === "whatsapp";

    // Tenta envio real via Cloud API quando for canal whatsapp
    if (isWhatsapp) {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: {
          conversa_id: selected.id,
          template: { template_id, nome_externo, idioma, variaveis },
        },
      });
      if (!error && data?.ok) {
        toast.success("Template enviado via WhatsApp");
        return;
      }
      const apiErr: any = (data as any)?.error || error?.message || "";
      if (apiErr && !String(apiErr).includes("não está configurado")) {
        toast.error(String(apiErr));
        return;
      }
      toast.warning("Canal WhatsApp não configurado — registrando como simulação local.");
    }

    // Fallback: registro local (simulado)
    const { error: insErr } = await supabase.from("mensagens").insert({
      conversa_id: selected.id,
      direcao: "outbound",
      conteudo: `[template:${nome_externo}]`,
      autor: "Atendente",
      lida: true,
      tipo: "template",
      metadata: { template_id, nome_externo, idioma, variaveis, status: "simulada", simulado: true },
    } as any);
    if (insErr) { toast.error(insErr.message); return; }
    toast.success("Template registrado (simulação local)");
  };

  const saveLead = async (patch: Partial<Lead>) => {
    if (!lead) return;
    const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
    if (error) toast.error(error.message);
    const updated = { ...lead, ...patch } as Lead;
    setLead(updated);
    toast.success("Lead atualizado");
    loadConversas();
  };

  const convertLead = async ({ valor, nome, data, plataforma }: { valor: number; nome: string; data: string; plataforma: string }) => {
    if (!lead) return;
    if (!valor || valor <= 0) { toast.error("Informe um valor maior que zero"); return; }
    if (!lead.telefone && !lead.email) { toast.error("Lead precisa ter telefone ou e-mail"); return; }
    const convertedAt = new Date(data).toISOString();

    // Verifica duplicação
    const { data: existing } = await supabase
      .from("conversoes_offline")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("plataforma", plataforma)
      .maybeSingle();
    if (existing) { toast.error("Já existe conversão para este lead nesta plataforma"); return; }

    const { error } = await supabase.from("leads").update({
      status: "convertido",
      convertido: true,
      convertido_em: convertedAt,
      data_conversao: convertedAt,
      valor_estimado: valor,
      valor_conversao: valor,
      nome_conversao: nome,
    } as any).eq("id", lead.id);
    if (error) { toast.error(error.message); return; }

    const leadAny = lead as any;
    const { error: e2 } = await supabase.from("conversoes_offline").insert({
      empresa_id: lead.empresa_id,
      lead_id: lead.id,
      conversa_id: selected?.id ?? null,
      plataforma,
      nome_conversao: nome,
      valor,
      descricao: nome,
      convertido_em: convertedAt,
      data_conversao: convertedAt,
      gclid: leadAny.gclid ?? null,
      fbclid: leadAny.fbclid ?? null,
      ttclid: leadAny.ttclid ?? null,
      email: lead.email,
      telefone: lead.telefone,
      status_envio: "pendente",
    } as any);
    if (e2) { toast.error(e2.message); return; }
    setLead({ ...lead, status: "convertido", convertido_em: convertedAt, valor_estimado: valor });
    toast.success("Conversão registrada! 🎉");
    loadConversas();
  };

  const atribuirContaFilha = async (contaId: string) => {
    if (!selected) return;
    // Segurança: só contas filhas dentro do escopo, vinculadas ao canal
    const conta = contas.find((c) => c.id === contaId);
    if (!conta || conta.tipo_conta !== "filha" || !scopedContaIds.includes(contaId)) {
      toast.error("Conta inválida para atribuição.");
      return;
    }
    if (selected.canal_id) {
      const vinculadas = canalContas[selected.canal_id] || [];
      if (!vinculadas.includes(contaId)) {
        toast.error("Esta conta filha não está vinculada ao canal.");
        return;
      }
    }
    const { error } = await supabase
      .from("conversas")
      .update({ empresa_id: contaId, conta_filha_pendente: false } as any)
      .eq("id", selected.id);
    if (error) { toast.error(error.message); return; }
    if (selected.lead_id) {
      await supabase.from("leads").update({ empresa_id: contaId } as any).eq("id", selected.lead_id);
    }
    await supabase.from("eventos_conversa" as any).insert({
      conversa_id: selected.id,
      tipo: "conta_filha_atribuida",
      payload: { conta_filha_id: contaId },
    });
    toast.success("Conta filha atribuída");
    setSelected({ ...selected, empresa_id: contaId, conta_filha_pendente: false });
    await loadConversas();
  };

  const contasDoCanalSelecionado = selected?.canal_id
    ? (canalContas[selected.canal_id] || [])
        .map((id) => contas.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => !!c && c.tipo_conta === "filha" && c.ativo && scopedContaIds.includes(c.id))
        .map((c) => ({ id: c.id, nome: c.nome }))
    : [];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <ConversationList
        conversas={conversas}
        canais={canais}
        selectedId={selected?.id ?? null}
        onSelect={openConversa}
      />
      <ChatPanel
        conversa={selected}
        mensagens={mensagens}
        onSend={sendMessage}
        onSendTemplate={sendTemplate}
        contasFilhasDoCanal={contasDoCanalSelecionado}
        onAtribuirContaFilha={atribuirContaFilha}
        onConversaPatch={(patch) => {
          if (!selected) return;
          const updated = { ...selected, ...patch } as Conversa;
          setSelected(updated);
          setConversas((list) => list.map((c) => (c.id === selected.id ? { ...c, ...patch } : c)));
        }}
      />
      <LeadPanel
        lead={lead}
        conversa={selected}
        lastInboundAt={mensagens.filter((m) => m.direcao === "inbound").slice(-1)[0]?.created_at ?? null}
        onSave={saveLead}
        onConvert={convertLead}
        onConversaPatch={(patch) => {
          if (!selected) return;
          const updated = { ...selected, ...patch } as Conversa;
          setSelected(updated);
          setConversas((list) => list.map((c) => (c.id === selected.id ? { ...c, ...patch } : c)));
        }}
      />
      
    </div>
  );
}
