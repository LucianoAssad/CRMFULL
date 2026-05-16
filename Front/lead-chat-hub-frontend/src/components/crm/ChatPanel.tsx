import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send, Phone, MoreVertical, MessageCircle, AlertTriangle, FileText, UserPlus, Zap, Clock,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Conversa, Mensagem } from "@/lib/crm-types";
import { CONVERSA_STATUS_LABEL } from "@/lib/crm-types";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { renderTemplate, extractVarCount, type WhatsappTemplate } from "@/pages/Templates";
import { hasPermission } from "@/lib/permissions";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { QUICK_REPLIES, MOTIVOS_FECHAMENTO } from "@/lib/quick-replies";

interface Props {
  conversa: Conversa | null;
  mensagens: Mensagem[];
  onSend: (text: string) => Promise<void> | void;
  onSendTemplate?: (payload: { template_id: string; nome_externo: string; idioma: string; variaveis: string[] }) => Promise<void> | void;
  contasFilhasDoCanal?: { id: string; nome: string }[];
  onAtribuirContaFilha?: (contaId: string) => Promise<void> | void;
  onConversaPatch?: (patch: Partial<Conversa>) => void;
}

const INFO_SECTIONS: { key: string; label: string }[] = [
  { key: "lead", label: "Ir para Lead" },
  { key: "atendimento", label: "Ir para Atendimento" },
  { key: "comercial", label: "Ir para Comercial" },
  { key: "orcamentos", label: "Ir para Orçamentos" },
  { key: "notas", label: "Ir para Notas" },
  { key: "origem", label: "Ir para Origem" },
  { key: "historico", label: "Ir para Histórico" },
  { key: "canal-tecnico", label: "Ir para Canal técnico" },
];

function focusInfoSection(section: string) {
  window.dispatchEvent(new CustomEvent("crm:focus-info-section", { detail: { section } }));
}

function canalLabel(tipo?: string | null) {
  switch (tipo) {
    case "whatsapp": return "WhatsApp";
    case "webchat": return "Webchat";
    case "instagram": return "Instagram";
    case "email": return "E-mail";
    default: return tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : "Canal";
  }
}

function formatHMS(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function ChatPanel({ conversa, mensagens, onSend, onSendTemplate, contasFilhasDoCanal, onAtribuirContaFilha, onConversaPatch }: Props) {
  const { usuarioId } = useAuth();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState<string>("atendimento_resolvido");
  const [responsavelNome, setResponsavelNome] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // Tick a cada segundo para o contador da janela 24h
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Carregar nome do responsável
  useEffect(() => {
    if (!conversa?.responsavel_id) { setResponsavelNome(null); return; }
    supabase.from("usuarios").select("nome").eq("id", conversa.responsavel_id).maybeSingle()
      .then((r) => setResponsavelNome((r as any)?.data?.nome ?? null));
  }, [conversa?.responsavel_id]);

  const isWhatsapp = conversa?.canal?.tipo === "whatsapp";
  const isOficial = isWhatsapp && conversa?.canal?.provider === "cloud_api";
  const isNaoOficial = isWhatsapp && !isOficial;
  const lastInbound = useMemo(() => {
    const inbound = mensagens.filter((m) => m.direcao === "inbound");
    if (inbound.length === 0) return null;
    return inbound.reduce((acc, m) => (new Date(m.created_at) > new Date(acc.created_at) ? m : acc));
  }, [mensagens]);

  const lastInboundMs = lastInbound ? new Date(lastInbound.created_at).getTime() : null;
  const restanteMs = lastInboundMs ? lastInboundMs + 24 * 3600 * 1000 - now : null;
  const dentroDaJanela = !isOficial || (restanteMs !== null && restanteMs > 0);
  const foraDaJanela = isOficial && !dentroDaJanela;

  if (!conversa) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center chat-bg-pattern">
        <div className="rounded-full bg-card p-6 shadow-[var(--shadow-panel)]">
          <MessageCircle className="h-12 w-12 text-primary" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Selecione uma conversa</h2>
        <p className="text-sm text-muted-foreground">Escolha um lead à esquerda para começar.</p>
      </div>
    );
  }

  const initials = (conversa.lead?.nome || "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const handleSend = async () => {
    if (!text.trim() || sending || foraDaJanela) return;
    if (!hasPermission("send_message")) return;
    setSending(true);
    await onSend(text.trim());
    setText("");
    setSending(false);
  };
  const canSend = hasPermission("send_message");

  const assumirConversa = async () => {
    if (!usuarioId) { toast.error("Usuário não identificado"); return; }
    const { error } = await supabase
      .from("conversas")
      .update({ responsavel_id: usuarioId } as any)
      .eq("id", conversa.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("eventos_conversa" as any).insert({
      conversa_id: conversa.id,
      tipo: "responsavel_assumido",
      usuario_id: usuarioId,
      payload: { responsavel_id: usuarioId },
    });
    onConversaPatch?.({ responsavel_id: usuarioId });
    toast.success("Você assumiu esta conversa");
  };

  const handleStatusChange = async (novoStatus: string) => {
    if (novoStatus === "fechada") { setCloseOpen(true); return; }
    const { error } = await supabase.from("conversas").update({ status: novoStatus } as any).eq("id", conversa.id);
    if (error) { toast.error(error.message); return; }
    onConversaPatch?.({ status: novoStatus as any });
    toast.success("Status atualizado");
  };

  const confirmarFechamento = async () => {
    const motivoLabel = MOTIVOS_FECHAMENTO.find((m) => m.id === closeReason)?.label || closeReason;
    const { error } = await supabase.from("conversas").update({ status: "fechada" } as any).eq("id", conversa.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("eventos_conversa" as any).insert({
      conversa_id: conversa.id,
      tipo: "conversa_fechada",
      usuario_id: usuarioId,
      payload: { motivo: closeReason, motivo_label: motivoLabel },
    });
    await supabase.from("conversa_notas").insert({
      empresa_id: conversa.empresa_id,
      conversa_id: conversa.id,
      usuario_id: usuarioId,
      conteudo: `Conversa fechada — motivo: ${motivoLabel}`,
    } as any);
    onConversaPatch?.({ status: "fechada" });
    setCloseOpen(false);
    toast.success("Conversa resolvida");
  };

  const janela24hLabel = (() => {
    if (foraDaJanela) return { text: "Fora da janela 24h", tone: "warn" as const };
    if (isOficial && lastInboundMs && restanteMs !== null && restanteMs > 0) {
      return { text: `Janela 24h: ${formatHMS(restanteMs)}`, tone: "ok" as const };
    }
    if (isOficial) return { text: "Janela 24h: verificar", tone: "muted" as const };
    return null;
  })();

  return (
    <section className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold">{conversa.lead?.nome}</h2>
            <span className="text-[11px] text-muted-foreground">· {canalLabel(conversa.canal?.tipo)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="truncate">{conversa.lead?.telefone || conversa.lead?.email}</span>
            <span>· {CONVERSA_STATUS_LABEL[conversa.status]}</span>
            {responsavelNome && <span>· Resp.: {responsavelNome}</span>}
          </div>
        </div>

        {janela24hLabel && (
          <Badge
            variant="outline"
            className={cn(
              "gap-1 font-mono text-[11px]",
              janela24hLabel.tone === "ok" && "border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
              janela24hLabel.tone === "warn" && "border-amber-500/40 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
              janela24hLabel.tone === "muted" && "text-muted-foreground",
            )}
            title="Janela de 24h do WhatsApp Cloud API"
          >
            <Clock className="h-3 w-3" /> {janela24hLabel.text}
          </Badge>
        )}

        {!conversa.responsavel_id && hasPermission("manage_crm") && (
          <Button size="sm" variant="default" onClick={assumirConversa}>
            <UserPlus className="mr-1 h-3.5 w-3.5" /> Assumir
          </Button>
        )}

        <Button variant="ghost" size="icon"><Phone className="h-4 w-4" /></Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Informações</DropdownMenuLabel>
            {INFO_SECTIONS.map((s) => (
              <DropdownMenuItem key={s.key} onClick={() => focusInfoSection(s.key)}>
                {s.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            {Object.entries(CONVERSA_STATUS_LABEL).map(([k, v]) => (
              <DropdownMenuItem key={k} onClick={() => handleStatusChange(k)}>
                {v}{conversa.status === k ? " ✓" : ""}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Dialog de motivo de fechamento */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar conversa</DialogTitle>
            <DialogDescription>Selecione o motivo do fechamento desta conversa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Select value={closeReason} onValueChange={setCloseReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOTIVOS_FECHAMENTO.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarFechamento}>Confirmar fechamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isNaoOficial && (
        <div className="border-b bg-orange-50 px-4 py-2 text-xs text-orange-900 dark:bg-orange-950/20 dark:text-orange-200">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          Este número usa integração não oficial. Pode haver risco de instabilidade, bloqueio ou falha no envio.
        </div>
      )}

      {conversa.conta_filha_pendente && (
        <PendingAssignBanner
          contas={contasFilhasDoCanal || []}
          onAssign={onAtribuirContaFilha}
        />
      )}

      <div className="scrollbar-thin chat-bg-pattern flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {mensagens.map((m) => (
            <Bubble key={m.id} m={m} />
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <footer className="border-t bg-card px-4 py-3">
        {foraDaJanela ? (
          <div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-50 p-3 dark:bg-amber-950/20">
            <div className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Esta conversa está fora da janela de 24h. Envie um template para retomar o contato.</p>
            </div>
            <TemplateDialog
              open={tplOpen}
              onOpenChange={setTplOpen}
              empresaId={conversa.empresa_id}
              onSend={async (payload) => {
                await onSendTemplate?.(payload);
                setTplOpen(false);
              }}
            />
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-full"
                  disabled={!canSend}
                  title="Respostas rápidas"
                >
                  <Zap className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel>Respostas rápidas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {QUICK_REPLIES.map((q) => (
                  <DropdownMenuItem key={q.id} onClick={() => setText(q.texto)} className="flex flex-col items-start gap-0.5">
                    <span className="text-xs font-medium">{q.titulo}</span>
                    <span className="line-clamp-2 text-[10px] text-muted-foreground">{q.texto}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={canSend ? "Digite uma mensagem ou escolha uma resposta rápida..." : "Sem permissão para enviar mensagens"}
              className="flex-1"
              disabled={!canSend}
            />
            <Button onClick={handleSend} disabled={!text.trim() || sending || !canSend} size="icon" className="rounded-full">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </footer>
    </section>
  );
}

function TemplateDialog({
  open, onOpenChange, empresaId, onSend,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string;
  onSend: (p: { template_id: string; nome_externo: string; idioma: string; variaveis: string[] }) => Promise<void>;
}) {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [vars, setVars] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !empresaId) return;
    (async () => {
      const { data } = await supabase
        .from("whatsapp_templates" as any)
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .eq("status", "aprovado")
        .order("nome");
      const list = ((data as any) || []).map((d: any) => ({ ...d, variaveis: d.variaveis ?? [] })) as WhatsappTemplate[];
      setTemplates(list);
      if (list.length && !templateId) setTemplateId(list[0].id);
    })();
  }, [open, empresaId]);

  const tpl = templates.find((t) => t.id === templateId) || null;
  const varCount = tpl ? extractVarCount(tpl.corpo) : 0;

  useEffect(() => {
    setVars(Array(varCount).fill(""));
  }, [templateId, varCount]);

  const preview = tpl ? renderTemplate(tpl.corpo, vars) : "";

  const submit = async () => {
    if (!tpl) return;
    setBusy(true);
    try {
      await onSend({ template_id: tpl.id, nome_externo: tpl.nome_externo, idioma: tpl.idioma, variaveis: vars });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="self-start">
          <FileText className="mr-2 h-4 w-4" /> Enviar template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar template do WhatsApp</DialogTitle>
          <DialogDescription>Necessário para retomar contato fora da janela de 24h.</DialogDescription>
        </DialogHeader>
        {templates.length === 0 ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
            Nenhum template aprovado e ativo para esta empresa. Cadastre em <strong>/templates</strong>.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome} <span className="text-muted-foreground">({t.idioma})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {varCount > 0 && tpl && (
              <div className="space-y-2">
                <Label>Variáveis</Label>
                {Array.from({ length: varCount }).map((_, i) => {
                  const def = tpl.variaveis?.[i];
                  return (
                    <Input
                      key={i}
                      placeholder={def?.exemplo || def?.label || `{{${i + 1}}}`}
                      value={vars[i] || ""}
                      onChange={(e) => { const c = [...vars]; c[i] = e.target.value; setVars(c); }}
                    />
                  );
                })}
              </div>
            )}
            {tpl && (
              <div className="space-y-1">
                <Label>Pré-visualização</Label>
                <div className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">{preview}</div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !tpl || (varCount > 0 && vars.some((v) => !v.trim()))}>
            {busy ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Bubble({ m }: { m: Mensagem }) {
  const out = m.direcao === "outbound";
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-[var(--shadow-bubble)]",
          out ? "rounded-br-sm bg-chat-bubble-out text-foreground" : "rounded-bl-sm bg-chat-bubble-in text-foreground"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
        <p className="mt-1 text-right text-[10px] text-muted-foreground">
          {format(new Date(m.created_at), "HH:mm")}
        </p>
      </div>
    </div>
  );
}

function PendingAssignBanner({
  contas, onAssign,
}: {
  contas: { id: string; nome: string }[];
  onAssign?: (id: string) => Promise<void> | void;
}) {
  const [val, setVal] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!val || !onAssign) return;
    setBusy(true);
    try { await onAssign(val); } finally { setBusy(false); }
  };
  return (
    <div className="border-b border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-start gap-2 flex-1">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Esta conversa precisa ser atribuída a uma conta filha.</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={val} onValueChange={setVal}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder={contas.length ? "Selecionar conta filha" : "Sem contas vinculadas"} />
            </SelectTrigger>
            <SelectContent>
              {contas.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={submit} disabled={!val || busy}>Atribuir</Button>
        </div>
      </div>
    </div>
  );
}
