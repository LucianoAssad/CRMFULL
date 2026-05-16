import { useEffect, useState } from "react";
import {
  BadgeCheck, Briefcase, Building2, Copy, FileText, Headphones, History,
  IdCard, Network, Save, Settings2, StickyNote, User, Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Lead, LeadStatus, Conversa } from "@/lib/crm-types";
import {
  LEAD_STATUS_LABEL, LEAD_STATUS_COLOR, scoreTier, SCORE_TIER_META,
  CONVERSA_STATUS_LABEL, PRIORIDADE_LABEL,
} from "@/lib/crm-types";
import { VendaDialog } from "./VendaDialog";
import { VendasHistorico } from "./VendasHistorico";
import { IdentidadesLista } from "./IdentidadesLista";
import { OportunidadesLead } from "./OportunidadesLead";
import { ConversaControles } from "./ConversaControles";
import { NotasInternas } from "./NotasInternas";
import { InfoSection } from "./InfoSection";
import { OrcamentosLista } from "./OrcamentosLista";
import { listarIdentidadesDoLead, syncLeadIdentidades, type LeadIdentidade } from "@/lib/lead-identidades";
import { cn } from "@/lib/utils";

interface Props {
  lead: Lead | null;
  conversa?: Conversa | null;
  lastInboundAt?: string | null;
  onSave: (patch: Partial<Lead>) => Promise<void> | void;
  onConvert: (data: { valor: number; nome: string; data: string; plataforma: string }) => Promise<void> | void;
  onConversaPatch?: (patch: Partial<Conversa>) => void;
}

type SectionKey =
  | "lead" | "atendimento" | "comercial" | "orcamentos" | "notas"
  | "origem" | "historico" | "canal-tecnico" | "cadastro" | "identidades";

const DEFAULT_OPEN: Record<SectionKey, boolean> = {
  lead: true, atendimento: true, comercial: true, orcamentos: true, notas: true,
  origem: false, historico: false, "canal-tecnico": false, cadastro: false, identidades: false,
};

export function LeadPanel({ lead, conversa, lastInboundAt, onSave, onConversaPatch }: Props) {
  const [form, setForm] = useState<Partial<Lead>>({});
  const [dirty, setDirty] = useState(false);
  const [vendasKey, setVendasKey] = useState(0);
  const [identidades, setIdentidades] = useState<LeadIdentidade[]>([]);
  const [openMap, setOpenMap] = useState<Record<SectionKey, boolean>>(DEFAULT_OPEN);
  const [highlighted, setHighlighted] = useState<SectionKey | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { section?: string } | undefined;
      const key = detail?.section as SectionKey | undefined;
      if (!key || !(key in DEFAULT_OPEN)) return;
      setOpenMap((m) => ({ ...m, [key]: true }));
      setHighlighted(key);
      window.setTimeout(() => setHighlighted((h) => (h === key ? null : h)), 1600);
    };
    window.addEventListener("crm:focus-info-section", handler as EventListener);
    return () => window.removeEventListener("crm:focus-info-section", handler as EventListener);
  }, []);

  const sectionProps = (k: SectionKey) => ({
    sectionKey: k,
    open: openMap[k],
    onOpenChange: (v: boolean) => setOpenMap((m) => ({ ...m, [k]: v })),
    highlighted: highlighted === k,
  });

  useEffect(() => {
    if (!lead) { setIdentidades([]); return; }
    listarIdentidadesDoLead(lead.id, lead.empresa_id).then(setIdentidades);
  }, [lead?.id, lead?.empresa_id, vendasKey]);

  useEffect(() => {
    if (lead) {
      setForm({
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        status: lead.status,
        notas: lead.notas,
        tipo_pessoa: lead.tipo_pessoa ?? null,
        cpf: lead.cpf ?? null,
        data_nascimento: lead.data_nascimento ?? null,
        razao_social: lead.razao_social ?? null,
        nome_fantasia: lead.nome_fantasia ?? null,
        cnpj: lead.cnpj ?? null,
        inscricao_estadual: lead.inscricao_estadual ?? null,
        cep: lead.cep ?? null,
        rua: lead.rua ?? null,
        numero: lead.numero ?? null,
        bairro: lead.bairro ?? null,
        cidade: lead.cidade ?? null,
        estado: lead.estado ?? null,
      });
      setDirty(false);
    }
  }, [lead?.id]);

  if (!lead) {
    return <aside className="hidden w-80 border-l bg-card lg:block" />;
  }

  const initials = (form.nome || lead.nome).split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const update = <K extends keyof Lead>(k: K, v: Lead[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const handleSave = async () => {
    await onSave(form);
    if (lead) {
      await syncLeadIdentidades({
        empresaId: lead.empresa_id,
        leadId: lead.id,
        telefone: (form.telefone as string) ?? lead.telefone,
        email: (form.email as string) ?? lead.email,
        origem: lead.origem,
        canalTipo: conversa?.canal?.tipo ?? null,
      });
      const fresh = await listarIdentidadesDoLead(lead.id, lead.empresa_id);
      setIdentidades(fresh);
    }
    setDirty(false);
  };

  const empresaLabel = lead.nome_fantasia || lead.razao_social || null;

  return (
    <aside className="hidden w-80 flex-col overflow-y-auto border-l bg-card lg:flex">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 border-b bg-gradient-to-b from-accent to-card px-4 py-5">
        <Avatar className="h-16 w-16 ring-4 ring-card">
          <AvatarFallback className="bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] text-lg text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Informações</div>
          <h2 className="text-base font-semibold">{form.nome || lead.nome}</h2>
          {empresaLabel && <p className="text-[11px] text-muted-foreground">{empresaLabel}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <Badge className={cn("border text-[10px]", LEAD_STATUS_COLOR[lead.status])} variant="outline">
            {LEAD_STATUS_LABEL[lead.status]}
          </Badge>
          {(() => {
            const tier = scoreTier(lead.score ?? 0);
            const meta = SCORE_TIER_META[tier];
            return (
              <Badge variant="outline" className={cn("border text-[10px]", meta.className)}>
                {meta.emoji} {meta.label} · {lead.score ?? 0}
              </Badge>
            );
          })()}
        </div>
      </div>

      <div className="space-y-2 p-3">
        {/* 1. Lead */}
        <InfoSection title="Lead" icon={<User className="h-3.5 w-3.5" />} {...sectionProps("lead")}>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="nome" className="text-[11px]">Nome</Label>
              <Input id="nome" className="h-8 text-xs" value={form.nome ?? ""} onChange={(e) => update("nome", e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="telefone" className="text-[11px]">Telefone</Label>
              <Input id="telefone" className="h-8 text-xs" value={form.telefone ?? ""} onChange={(e) => update("telefone", e.target.value)} maxLength={30} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email" className="text-[11px]">E-mail</Label>
              <Input id="email" className="h-8 text-xs" type="email" value={form.email ?? ""} onChange={(e) => update("email", e.target.value)} maxLength={150} />
            </div>
            {empresaLabel && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Building2 className="h-3 w-3" /> {empresaLabel}
              </div>
            )}
            {lead.origem && (
              <div className="text-[11px] text-muted-foreground">
                Origem: <span className="font-medium text-foreground">{lead.origem}</span>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[11px]">Status do pipeline</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v as LeadStatus)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAD_STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {dirty && (
              <Button onClick={handleSave} size="sm" variant="secondary" className="w-full">
                <Save className="mr-1 h-3.5 w-3.5" /> Salvar alterações
              </Button>
            )}
          </div>
        </InfoSection>

        {/* 2. Atendimento */}
        <InfoSection title="Atendimento" icon={<Headphones className="h-3.5 w-3.5" />} {...sectionProps("atendimento")}>
          {conversa ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <Meta label="Status" value={CONVERSA_STATUS_LABEL[conversa.status] ?? conversa.status} />
                <Meta label="Prioridade" value={PRIORIDADE_LABEL[conversa.prioridade as keyof typeof PRIORIDADE_LABEL] ?? conversa.prioridade ?? "—"} />
                <Meta label="Canal" value={conversa.canal?.tipo ?? "—"} />
                <Meta label="Última msg" value={conversa.ultima_mensagem_em ? new Date(conversa.ultima_mensagem_em).toLocaleString("pt-BR") : "—"} />
              </div>
              <ConversaControles conversa={conversa} onChanged={onConversaPatch} />
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Nenhuma conversa selecionada.</p>
          )}
        </InfoSection>

        {/* 3. Comercial */}
        <InfoSection title="Comercial" icon={<Briefcase className="h-3.5 w-3.5" />} {...sectionProps("comercial")}>
          <OportunidadesLead
            empresaId={lead.empresa_id}
            leadId={lead.id}
            conversaId={conversa?.id ?? null}
            canalOrigem={conversa?.canal?.tipo ?? null}
            origem={lead.origem}
            compact
          />
        </InfoSection>

        {/* 4. Orçamentos */}
        <InfoSection
          title="Orçamentos"
          icon={<FileText className="h-3.5 w-3.5" />}
          {...sectionProps("orcamentos")}
        >
          <OrcamentosLista empresaId={lead.empresa_id} lead={lead} conversa={conversa ?? null} />
        </InfoSection>

        {/* 5. Notas internas */}
        <InfoSection title="Notas internas" icon={<StickyNote className="h-3.5 w-3.5" />} {...sectionProps("notas")}>
          {conversa ? (
            <NotasInternas empresaId={conversa.empresa_id} conversaId={conversa.id} />
          ) : (
            <p className="text-[11px] text-muted-foreground">Selecione uma conversa para registrar notas.</p>
          )}
        </InfoSection>

        {/* 6. Origem */}
        <InfoSection title="Origem" icon={<Network className="h-3.5 w-3.5" />} {...sectionProps("origem")}>
          <MarketingSection lead={lead} />
        </InfoSection>

        {/* 7. Histórico */}
        <InfoSection title="Histórico" icon={<History className="h-3.5 w-3.5" />} {...sectionProps("historico")}>
          <div className="space-y-3">
            <VendasHistorico leadId={lead.id} refreshKey={vendasKey} />
            <div className="rounded-md border bg-muted/20 p-2 space-y-2">
              <p className="text-[10px] text-muted-foreground">
                Fluxo legado de venda direta. O fluxo recomendado será via orçamento.
              </p>
              <VendaDialog lead={lead} onSaved={() => setVendasKey((k) => k + 1)} />
            </div>
          </div>
        </InfoSection>

        {/* 8. Canal técnico */}
        <InfoSection title="Canal técnico" icon={<Wifi className="h-3.5 w-3.5" />} {...sectionProps("canal-tecnico")}>
          <CanalAtendimentoSection conversa={conversa ?? null} lastInboundAt={lastInboundAt ?? null} />
        </InfoSection>

        {/* 9. Cadastro completo */}
        <InfoSection title="Cadastro completo" icon={<IdCard className="h-3.5 w-3.5" />} {...sectionProps("cadastro")}>
          <CadastroSection form={form} update={update} />
          {dirty && (
            <Button onClick={handleSave} size="sm" variant="secondary" className="mt-3 w-full">
              <Save className="mr-1 h-3.5 w-3.5" /> Salvar alterações
            </Button>
          )}
        </InfoSection>

        {/* 10. Identidades */}
        <InfoSection title="Identidades" icon={<BadgeCheck className="h-3.5 w-3.5" />} {...sectionProps("identidades")}>
          <IdentidadesLista identidades={identidades} compact />
          <p className="mt-2 text-[10px] text-muted-foreground">
            Mesmo cliente pode aparecer em diferentes canais (WhatsApp, Email, Webchat, Instagram...).
          </p>
        </InfoSection>
      </div>
    </aside>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-1.5">
      <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
      <div className="truncate font-medium">{value}</div>
    </div>
  );
}

function MarketingSection({ lead }: { lead: Lead }) {
  const fields: { key: keyof Lead; label: string }[] = [
    { key: "origem", label: "Origem" },
    { key: "canal_primeiro_contato" as any, label: "Canal 1º contato" },
    { key: "utm_source", label: "UTM Source" },
    { key: "utm_medium", label: "UTM Medium" },
    { key: "utm_campaign", label: "UTM Campaign" },
    { key: "utm_content", label: "UTM Content" },
    { key: "utm_term", label: "UTM Term" },
    { key: "fbclid", label: "fbclid" },
    { key: "ttclid", label: "ttclid" },
  ];
  const visible = fields.filter((f) => lead[f.key]);
  const gclid = (lead as any).gclid as string | null | undefined;

  const copy = async (val: string) => {
    try { await navigator.clipboard.writeText(val); toast.success("Copiado"); } catch { toast.error("Falha ao copiar"); }
  };

  const created = lead.created_at ? new Date(lead.created_at).toLocaleString("pt-BR") : "-";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border bg-muted/30 p-2">
          <div className="text-[10px] uppercase text-muted-foreground">Criado em</div>
          <div className="font-medium">{created}</div>
        </div>
        <div className="rounded-md border bg-muted/30 p-2">
          <div className="text-[10px] uppercase text-muted-foreground">Status</div>
          <div className="font-medium">{LEAD_STATUS_LABEL[lead.status]}</div>
        </div>
      </div>

      {gclid && (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-2">
          <div className="mb-1 flex items-center justify-between">
            <Badge variant="outline" className="border-primary/40 text-primary">gclid</Badge>
            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copy(gclid)}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <div className="break-all font-mono text-xs">{gclid}</div>
        </div>
      )}

      {visible.length === 0 && !gclid ? (
        <p className="text-xs text-muted-foreground">Sem dados de origem capturados.</p>
      ) : (
        <dl className="space-y-1.5 text-xs">
          {visible.map((f) => (
            <div key={String(f.key)} className="flex items-start justify-between gap-2 border-b border-border/50 pb-1.5 last:border-0">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="break-all text-right font-medium">{String(lead[f.key])}</dd>
            </div>
          ))}
        </dl>
      )}

      {(lead as any).page_url && (
        <div className="text-xs">
          <div className="text-muted-foreground">Página de entrada</div>
          <div className="break-all font-mono text-[11px]">{(lead as any).page_url}</div>
        </div>
      )}
    </div>
  );
}

function CadastroSection({
  form,
  update,
}: {
  form: Partial<Lead>;
  update: <K extends keyof Lead>(k: K, v: Lead[K]) => void;
}) {
  const tipo = (form.tipo_pessoa ?? "fisica") as "fisica" | "juridica";

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[11px]">Tipo de pessoa</Label>
        <Select
          value={tipo}
          onValueChange={(v) => update("tipo_pessoa", v as any)}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fisica">Pessoa física</SelectItem>
            <SelectItem value="juridica">Pessoa jurídica</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tipo === "fisica" ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="cpf" className="text-[11px]">CPF</Label>
            <Input id="cpf" className="h-8 text-xs" value={form.cpf ?? ""} onChange={(e) => update("cpf", e.target.value)} maxLength={20} placeholder="000.000.000-00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nasc" className="text-[11px]">Data de nascimento</Label>
            <Input id="nasc" className="h-8 text-xs" type="date" value={form.data_nascimento ?? ""} onChange={(e) => update("data_nascimento", e.target.value)} />
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="razao" className="text-[11px]">Razão social</Label>
            <Input id="razao" className="h-8 text-xs" value={form.razao_social ?? ""} onChange={(e) => update("razao_social", e.target.value)} maxLength={150} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fantasia" className="text-[11px]">Nome fantasia</Label>
            <Input id="fantasia" className="h-8 text-xs" value={form.nome_fantasia ?? ""} onChange={(e) => update("nome_fantasia", e.target.value)} maxLength={150} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cnpj" className="text-[11px]">CNPJ</Label>
            <Input id="cnpj" className="h-8 text-xs" value={form.cnpj ?? ""} onChange={(e) => update("cnpj", e.target.value)} maxLength={20} placeholder="00.000.000/0000-00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ie" className="text-[11px]">Inscrição estadual</Label>
            <Input id="ie" className="h-8 text-xs" value={form.inscricao_estadual ?? ""} onChange={(e) => update("inscricao_estadual", e.target.value)} maxLength={30} />
          </div>
        </>
      )}

      <div className="pt-1">
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Endereço</h4>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1 space-y-1.5">
            <Label htmlFor="cep" className="text-[11px]">CEP</Label>
            <Input id="cep" className="h-8 text-xs" value={form.cep ?? ""} onChange={(e) => update("cep", e.target.value)} maxLength={10} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="rua" className="text-[11px]">Rua</Label>
            <Input id="rua" className="h-8 text-xs" value={form.rua ?? ""} onChange={(e) => update("rua", e.target.value)} maxLength={150} />
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="numero" className="text-[11px]">Número</Label>
            <Input id="numero" className="h-8 text-xs" value={form.numero ?? ""} onChange={(e) => update("numero", e.target.value)} maxLength={20} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="bairro" className="text-[11px]">Bairro</Label>
            <Input id="bairro" className="h-8 text-xs" value={form.bairro ?? ""} onChange={(e) => update("bairro", e.target.value)} maxLength={100} />
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="cidade" className="text-[11px]">Cidade</Label>
            <Input id="cidade" className="h-8 text-xs" value={form.cidade ?? ""} onChange={(e) => update("cidade", e.target.value)} maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="estado" className="text-[11px]">UF</Label>
            <Input id="estado" className="h-8 text-xs" value={form.estado ?? ""} onChange={(e) => update("estado", e.target.value)} maxLength={2} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CanalAtendimentoSection({ conversa, lastInboundAt }: { conversa: Conversa | null; lastInboundAt: string | null }) {
  if (!conversa) {
    return <p className="text-[11px] text-muted-foreground">Nenhuma conversa selecionada.</p>;
  }
  const canal = conversa.canal;
  const tipo = canal?.tipo || "—";
  const provider = canal?.provider || (tipo === "whatsapp" ? "—" : "n/a");
  const identificador = canal?.identificador || (canal?.configuracoes as any)?.phone_number_id || "—";
  const ativo = canal?.ativo;
  const isWhatsapp = tipo === "whatsapp";
  const isOficial = isWhatsapp && provider === "cloud_api";

  let janela: { label: string; className: string } = { label: "Não aplicável", className: "bg-muted text-muted-foreground" };
  if (isOficial) {
    if (lastInboundAt) {
      const horas = (Date.now() - new Date(lastInboundAt).getTime()) / 3_600_000;
      janela = horas < 24
        ? { label: `Aberta (${Math.floor(24 - horas)}h restantes)`, className: "bg-emerald-100 text-emerald-800 border-emerald-300" }
        : { label: "Fechada (>24h)", className: "bg-amber-100 text-amber-800 border-amber-300" };
    } else {
      janela = { label: "Fechada (sem mensagem do cliente)", className: "bg-amber-100 text-amber-800 border-amber-300" };
    }
  }

  const ultima = lastInboundAt ? new Date(lastInboundAt).toLocaleString("pt-BR") : "—";

  return (
    <dl className="space-y-1.5 text-xs">
      <Row label="Canal" value={tipo} />
      <Row label="Provider" value={provider} />
      <Row label="Identificador" value={identificador} mono />
      <Row label="Status" value={ativo ? "Ativo" : "Inativo"} />
      <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-1.5">
        <dt className="text-muted-foreground">Janela 24h</dt>
        <dd><Badge variant="outline" className={janela.className}>{janela.label}</Badge></dd>
      </div>
      <Row label="Última msg do cliente" value={ultima} />
    </dl>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("break-all text-right font-medium", mono && "font-mono text-[11px]")}>{value}</dd>
    </div>
  );
}
