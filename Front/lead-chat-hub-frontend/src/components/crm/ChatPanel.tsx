import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Send, Phone, MoreVertical, MessageCircle, AlertTriangle, FileText, UserPlus, Zap, Clock, Mic, Square, CalendarClock, Package, Search, CalendarPlus,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  { key: "agendamentos", label: "Ir para Agendamentos" },
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

// Variáveis disponíveis para substituição via "\"
const LEAD_VARS: { label: string; key: string; getValue: (c: Conversa) => string }[] = [
  { label: "Nome", key: "nome", getValue: (c) => c.lead?.nome || "" },
  { label: "Primeiro nome", key: "primeiro_nome", getValue: (c) => (c.lead?.nome || "").split(" ")[0] },
  { label: "Telefone", key: "telefone", getValue: (c) => c.lead?.telefone || "" },
  { label: "Email", key: "email", getValue: (c) => c.lead?.email || "" },
  { label: "CPF", key: "cpf", getValue: (c) => (c.lead as any)?.cpf || "" },
  { label: "Cidade", key: "cidade", getValue: (c) => (c.lead as any)?.cidade || "" },
  { label: "Estado", key: "estado", getValue: (c) => (c.lead as any)?.estado || "" },
];

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
  const inputRef = useRef<HTMLInputElement>(null);

  // Quick replies
  const [dbQuickReplies, setDbQuickReplies] = useState<{ id: string; atalho: string; conteudo: string }[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [qrFilter, setQrFilter] = useState("");
  const [qrIndex, setQrIndex] = useState(0);

  // Variable picker
  const [showVars, setShowVars] = useState(false);
  const [varIndex, setVarIndex] = useState(0);

  // Quick agendamento a partir da conversa
  const [agOpen, setAgOpen] = useState(false);
  const [agForm, setAgForm] = useState({ titulo: "", tipo: "reuniao", data_inicio: "", notas: "" });

  // Catálogo de produtos
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [produtos, setProdutos] = useState<{ id: string; nome: string; descricao: string | null; valor_padrao: number }[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");

  // Mensagem programada
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [schedText, setSchedText] = useState("");

  // PTT — gravação de áudio
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Carregar respostas rápidas do banco
  useEffect(() => {
    if (!conversa?.empresa_id) return;
    supabase
      .from("respostas_rapidas" as any)
      .select("id,atalho,conteudo")
      .eq("empresa_id", conversa.empresa_id)
      .eq("ativo", true)
      .order("atalho")
      .then(({ data }) => setDbQuickReplies((data as any) || []));
  }, [conversa?.empresa_id]);

  // Fechar popups ao mudar conversa
  useEffect(() => { setShowQR(false); setShowVars(false); setText(""); }, [conversa?.id]);

  // Carregar produtos quando o catálogo abre
  useEffect(() => {
    if (!catalogOpen || !conversa?.empresa_id) return;
    supabase
      .from("produtos_servicos" as any)
      .select("id,nome,descricao,valor_padrao")
      .eq("empresa_id", conversa.empresa_id)
      .eq("ativo", true)
      .order("nome")
      .limit(200)
      .then(({ data }) => setProdutos((data as any) || []));
  }, [catalogOpen, conversa?.empresa_id]);

  const isWhatsapp = conversa?.canal?.tipo === "whatsapp";
  const isOficial = isWhatsapp && (conversa?.canal?.provider === "cloud_api" || conversa?.canal?.provider === "whatsapp_oficial");
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

  // Filtra quick replies pela busca após "/"
  const allQuickReplies = dbQuickReplies.length > 0 ? dbQuickReplies : QUICK_REPLIES.map((q) => ({ id: q.id, atalho: q.titulo, conteudo: q.texto }));
  const filteredQR = allQuickReplies.filter((q) =>
    !qrFilter || q.atalho.toLowerCase().includes(qrFilter) || q.conteudo.toLowerCase().includes(qrFilter),
  );

  const handleTextChange = (val: string) => {
    setText(val);
    if (val.startsWith("/")) {
      setQrFilter(val.slice(1).toLowerCase());
      setShowQR(true);
      setShowVars(false);
      setQrIndex(0);
    } else if (val.endsWith("\\")) {
      setShowVars(true);
      setShowQR(false);
      setVarIndex(0);
    } else {
      setShowQR(false);
      setShowVars(false);
    }
  };

  const selectQR = (conteudo: string) => {
    setText(conteudo);
    setShowQR(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const selectVar = (v: { label: string; key: string; getValue: (c: Conversa) => string }) => {
    const val = conversa ? v.getValue(conversa) : "";
    // Substitui a "\" no final pelo valor da variável
    setText((prev) => prev.replace(/\\$/, val));
    setShowVars(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showQR && filteredQR.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setQrIndex((i) => Math.min(i + 1, filteredQR.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setQrIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter") { e.preventDefault(); selectQR(filteredQR[qrIndex].conteudo); return; }
      if (e.key === "Escape") { setShowQR(false); return; }
    }
    if (showVars && LEAD_VARS.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setVarIndex((i) => Math.min(i + 1, LEAD_VARS.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setVarIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter") { e.preventDefault(); selectVar(LEAD_VARS[varIndex]); return; }
      if (e.key === "Escape") { setShowVars(false); return; }
    }
    if (e.key === "Enter") handleSend();
  };

  const handleAgSave = async () => {
    if (!agForm.titulo.trim() || !agForm.data_inicio || !conversa?.lead_id) return;
    const { error } = await supabase.from("agendamentos" as any).insert({
      empresa_id: conversa.empresa_id,
      lead_id: conversa.lead_id,
      conversa_id: conversa.id,
      titulo: agForm.titulo.trim(),
      tipo: agForm.tipo,
      data_inicio: new Date(agForm.data_inicio).toISOString(),
      notas: agForm.notas || null,
      status: "agendado",
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Agendamento criado!");
    setAgOpen(false);
    setAgForm({ titulo: "", tipo: "reuniao", data_inicio: "", notas: "" });
  };

  const handleSchedSend = async () => {
    if (!schedText.trim() || !schedDate || !schedTime || !conversa) return;
    const agendadoPara = `${schedDate}T${schedTime}:00`;
    const { error } = await supabase.from("mensagens_programadas" as any).insert({
      empresa_id: conversa.empresa_id,
      conversa_id: conversa.id,
      conteudo: schedText.trim(),
      agendado_para: agendadoPara,
      status: "pendente",
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(`Mensagem agendada para ${new Date(agendadoPara).toLocaleString("pt-BR")}`);
    setSchedOpen(false);
    setSchedText("");
    setSchedDate("");
    setSchedTime("");
  };

  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        setRecording(false);
        setRecSeconds(0);
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size < 500) return; // descarta gravações muito curtas
        await sendAudio(blob);
      };
      mr.start(200);
      mediaRecRef.current = mr;
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Microfone não disponível. Verifique as permissões do navegador.");
    }
  };

  const stopRecording = () => {
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
      mediaRecRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
      mediaRecRef.current.ondataavailable = null;
      mediaRecRef.current.onstop = null;
      mediaRecRef.current.stop();
      mediaRecRef.current.stream?.getTracks().forEach((t) => t.stop());
    }
    audioChunksRef.current = [];
    setRecording(false);
    setRecSeconds(0);
  };

  const sendAudio = async (blob: Blob) => {
    setSending(true);
    try {
      // Para WABA (Cloud API oficial), o formato recomendado é audio/ogg;codecs=opus
      // Tentamos converter para o formato mais compatível disponível no browser
      const isOficialCanal = conversa?.canal?.provider === "cloud_api" || conversa?.canal?.provider === "whatsapp_oficial";

      // Tenta recodificar para ogg/opus se for canal oficial e o blob não for ogg
      let finalBlob = blob;
      if (isOficialCanal && !blob.type.includes("ogg")) {
        try {
          // Usa AudioContext para decodificar e re-encodar via MediaRecorder em ogg/opus
          const arrayBuffer = await blob.arrayBuffer();
          const audioCtx = new AudioContext();
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          const dest = audioCtx.createMediaStreamDestination();
          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(dest);
          source.start();

          const oggMime = "audio/ogg;codecs=opus";
          if (MediaRecorder.isTypeSupported(oggMime)) {
            const chunks: BlobPart[] = [];
            const mr = new MediaRecorder(dest.stream, { mimeType: oggMime });
            await new Promise<void>((res) => {
              mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
              mr.onstop = () => { finalBlob = new Blob(chunks, { type: oggMime }); res(); };
              mr.start();
              setTimeout(() => mr.stop(), (audioBuffer.duration * 1000) + 200);
            });
            audioCtx.close();
          }
        } catch {
          // fallback: envia o blob original
        }
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const ext = finalBlob.type.includes("ogg") ? "ogg" : "webm";
        // Prefixo especial para o gateway identificar como PTT
        await onSend(`[audio:${ext}:${base64}]`);
        setSending(false);
      };
      reader.readAsDataURL(finalBlob);
    } catch {
      toast.error("Erro ao enviar áudio");
      setSending(false);
    }
  };

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
            <DropdownMenuItem onClick={() => { setSchedText(text); setSchedOpen(true); }}>
              <CalendarClock className="mr-2 h-4 w-4" /> Agendar mensagem
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setCatalogSearch(""); setCatalogOpen(true); }}>
              <Package className="mr-2 h-4 w-4" /> Catálogo de produtos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setAgForm({ titulo: "", tipo: "reuniao", data_inicio: "", notas: "" }); setAgOpen(true); }}>
              <CalendarPlus className="mr-2 h-4 w-4" /> Criar agendamento
            </DropdownMenuItem>
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

      {/* Dialog mensagem programada */}
      <Dialog open={schedOpen} onOpenChange={setSchedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar mensagem</DialogTitle>
            <DialogDescription>A mensagem será enviada automaticamente na data e hora escolhidas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Mensagem</Label>
              <textarea
                value={schedText}
                onChange={(e) => setSchedText(e.target.value)}
                rows={3}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                placeholder="Digite a mensagem a ser enviada..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data</Label>
                <input
                  type="date"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <Label>Hora</Label>
                <input
                  type="time"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchedOpen(false)}>Cancelar</Button>
            <Button onClick={handleSchedSend} disabled={!schedText.trim() || !schedDate || !schedTime}>
              <CalendarClock className="mr-2 h-4 w-4" /> Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog quick agendamento */}
      <Dialog open={agOpen} onOpenChange={setAgOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle><CalendarPlus className="inline mr-2 h-4 w-4" />Novo agendamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input value={agForm.titulo} onChange={(e) => setAgForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Reunião de apresentação" />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={agForm.tipo} onValueChange={(v) => setAgForm((f) => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[{v:"reuniao",l:"🤝 Reunião"},{v:"ligacao",l:"📞 Ligação"},{v:"visita",l:"🏠 Visita"},{v:"tarefa",l:"✅ Tarefa"},{v:"follow_up",l:"🔔 Follow-up"}].map((t) => (
                    <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data e hora *</Label>
              <input
                type="datetime-local"
                value={agForm.data_inicio}
                onChange={(e) => setAgForm((f) => ({ ...f, data_inicio: e.target.value }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <textarea value={agForm.notas} onChange={(e) => setAgForm((f) => ({ ...f, notas: e.target.value }))} rows={2} className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" placeholder="Observações..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgOpen(false)}>Cancelar</Button>
            <Button onClick={handleAgSave} disabled={!agForm.titulo.trim() || !agForm.data_inicio}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog catálogo de produtos */}
      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle><Package className="inline mr-2 h-4 w-4" />Catálogo de produtos</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full rounded-md border bg-background pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {produtos
              .filter((p) => !catalogSearch || p.nome.toLowerCase().includes(catalogSearch.toLowerCase()))
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const msg = `*${p.nome}*${p.descricao ? `\n${p.descricao}` : ""}\n💰 R$ ${Number(p.valor_padrao).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
                    setText((prev) => prev ? `${prev}\n${msg}` : msg);
                    setCatalogOpen(false);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                  className="w-full rounded-md border p-2.5 text-left hover:bg-accent transition-colors"
                >
                  <p className="text-sm font-medium">{p.nome}</p>
                  {p.descricao && <p className="text-xs text-muted-foreground line-clamp-1">{p.descricao}</p>}
                  <p className="text-xs text-primary font-medium mt-0.5">
                    R$ {Number(p.valor_padrao).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </button>
              ))}
            {produtos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto cadastrado.</p>}
          </div>
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

      {foraDaJanela && (
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            ⏰ Janela de 24h encerrada. Use um template aprovado para retomar o contato.
          </AlertDescription>
        </Alert>
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
                  title="Respostas rápidas (ou digite / no campo)"
                >
                  <Zap className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel>Respostas rápidas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {allQuickReplies.map((q) => (
                  <DropdownMenuItem key={q.id} onClick={() => selectQR(q.conteudo)} className="flex flex-col items-start gap-0.5">
                    <span className="text-xs font-medium">/{q.atalho}</span>
                    <span className="line-clamp-2 text-[10px] text-muted-foreground">{q.conteudo}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Botão catálogo */}
            <Button
              size="icon"
              variant="outline"
              className="rounded-full"
              disabled={!canSend}
              title="Catálogo de produtos"
              onClick={() => { setCatalogSearch(""); setCatalogOpen(true); }}
            >
              <Package className="h-4 w-4" />
            </Button>

            {/* Input com popups de quick-reply e variáveis */}
            <div className="relative flex-1">
              {/* Popup quick replies */}
              {showQR && filteredQR.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1 z-50 w-full max-h-52 overflow-y-auto rounded-md border bg-popover shadow-md">
                  <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Respostas rápidas</p>
                  {filteredQR.map((q, i) => (
                    <button
                      key={q.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectQR(q.conteudo); }}
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent",
                        i === qrIndex && "bg-accent",
                      )}
                    >
                      <span className="font-medium text-xs text-primary">/{q.atalho}</span>
                      <span className="line-clamp-2 text-[11px] text-muted-foreground">{q.conteudo}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Popup variáveis do contato */}
              {showVars && (
                <div className="absolute bottom-full left-0 mb-1 z-50 w-64 rounded-md border bg-popover shadow-md">
                  <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Variáveis do contato</p>
                  {LEAD_VARS.map((v, i) => (
                    <button
                      key={v.key}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectVar(v); }}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent",
                        i === varIndex && "bg-accent",
                      )}
                    >
                      <span className="font-medium">{v.label}</span>
                      <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                        {conversa ? v.getValue(conversa) || "—" : "—"}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <Input
                ref={inputRef}
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={canSend ? "Mensagem… ( / respostas rápidas · \\ variáveis )" : "Sem permissão para enviar mensagens"}
                className="w-full"
                disabled={!canSend}
              />
            </div>

            {text.trim() ? (
              <Button onClick={handleSend} disabled={sending || !canSend} size="icon" className="rounded-full">
                <Send className="h-4 w-4" />
              </Button>
            ) : recording ? (
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono text-destructive animate-pulse min-w-[40px]">
                  {String(Math.floor(recSeconds / 60)).padStart(2, "0")}:{String(recSeconds % 60).padStart(2, "0")}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full text-muted-foreground"
                  title="Cancelar gravação"
                  onClick={cancelRecording}
                >
                  <Square className="h-4 w-4 fill-current" />
                </Button>
                <Button
                  size="icon"
                  className="rounded-full bg-destructive hover:bg-destructive/90"
                  title="Enviar áudio"
                  onClick={stopRecording}
                  disabled={sending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                size="icon"
                variant="outline"
                className="rounded-full"
                title="Gravar áudio"
                onClick={startRecording}
                disabled={!canSend || sending}
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
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
