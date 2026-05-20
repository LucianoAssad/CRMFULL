import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, ChevronDown, ChevronRight, Users, AlertTriangle, ExternalLink, Share2, User } from "lucide-react";
import { CanalContasManager } from "@/components/CanalContasManager";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";

type CanalTipo = "whatsapp" | "webchat" | "email" | "instagram" | "messenger" | "telegram" | "tiktok" | "facebook";
type Provider =
  | "whatsapp_oficial"
  | "whatsapp_nao_oficial"
  | "webchat"
  | "email_smtp"
  | "sms_api"
  | "meta"
  | "outro";

const CANAIS: { v: CanalTipo; l: string }[] = [
  { v: "whatsapp", l: "WhatsApp" },
  { v: "webchat", l: "Webchat" },
  { v: "email", l: "E-mail" },
  { v: "instagram", l: "Instagram Direct" },
  { v: "messenger", l: "Messenger" },
  { v: "facebook", l: "Facebook" },
  { v: "telegram", l: "Telegram" },
  { v: "tiktok", l: "TikTok" },
];

const PROVIDERS: { v: Provider; l: string }[] = [
  { v: "whatsapp_oficial", l: "WhatsApp Oficial (Cloud API)" },
  { v: "whatsapp_nao_oficial", l: "WhatsApp Não Oficial" },
  { v: "webchat", l: "Webchat" },
  { v: "email_smtp", l: "E-mail SMTP" },
  { v: "sms_api", l: "SMS API" },
  { v: "meta", l: "Meta (Instagram/Messenger)" },
  { v: "outro", l: "Outro" },
];

interface Conexao {
  id: string;
  empresa_id: string;
  tipo: CanalTipo;
  nome: string;
  nome_exibicao: string | null;
  identificador: string | null;
  provider: Provider | null;
  configuracoes: Record<string, unknown>;
  ativo: boolean;
  created_at: string;
}

type StatusConexao = "preparacao" | "conectado" | "erro";

const empty = {
  tipo: "whatsapp" as CanalTipo,
  nome: "",
  nome_exibicao: "",
  identificador: "",
  provider: "whatsapp_oficial" as Provider,
  ativo: true,
  uso: "individual" as "individual" | "compartilhado",
  status: "preparacao" as StatusConexao,
  cfg: {} as Record<string, string>,
};

// Define quais providers fazem sentido para cada tipo de canal
const PROVIDERS_BY_TIPO: Record<CanalTipo, Provider[]> = {
  whatsapp: ["whatsapp_oficial", "whatsapp_nao_oficial"],
  webchat: ["webchat"],
  email: ["email_smtp", "outro"],
  instagram: ["meta"],
  messenger: ["meta"],
  facebook: ["meta"],
  telegram: ["outro"],
  tiktok: ["outro"],
};

const DEFAULT_PROVIDER: Record<CanalTipo, Provider> = {
  whatsapp: "whatsapp_oficial",
  webchat: "webchat",
  email: "email_smtp",
  instagram: "meta",
  messenger: "meta",
  facebook: "meta",
  telegram: "outro",
  tiktok: "outro",
};

// Deriva o "identificador" textual a partir dos campos específicos
function identificadorPara(f: { tipo: CanalTipo; provider: Provider; cfg: Record<string, string> }) {
  const c = f.cfg || {};
  if (f.tipo === "whatsapp") return c.numero_exibido || c.numero || "";
  if (f.tipo === "webchat") return c.slug || "";
  if (f.tipo === "instagram") return c.instagram_business_id || "";
  if (f.tipo === "messenger" || f.tipo === "facebook") return c.page_id || "";
  if (f.tipo === "telegram") return c.bot_username || "";
  if (f.tipo === "tiktok") return c.business_account_id || "";
  if (f.tipo === "email") return c.email_remetente || "";
  return "";
}

const STATUS_LABEL: Record<StatusConexao, string> = {
  preparacao: "Configuração em preparação",
  conectado: "Conectado",
  erro: "Erro de conexão",
};

export default function Conexoes() {
  const { activeConta, activeContaId } = useActiveAccount();
  const [items, setItems] = useState<Conexao[]>([]);
  const [vinculosCount, setVinculosCount] = useState<Record<string, number>>({});
  const [vinculosOwners, setVinculosOwners] = useState<Record<string, string[]>>({}); // canalId -> conta ids
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Conexao | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [reloadKey, setReloadKey] = useState(0);

  const isFilha = activeConta?.tipo_conta === "filha";

  const load = async () => {
    if (!isFilha || !activeContaId) { setItems([]); return; }

    // 1) canais próprios
    const { data: ownData, error: ownErr } = await supabase
      .from("canais_conectados")
      .select("*")
      .eq("empresa_id", activeContaId);
    if (ownErr) { toast.error(ownErr.message); return; }

    // 2) canais compartilhados (via canal_contas)
    const { data: shareLinks } = await supabase
      .from("canal_contas")
      .select("canal_conectado_id")
      .eq("conta_filha_id", activeContaId)
      .eq("ativo", true);
    const sharedIds = ((shareLinks as any) || []).map((r: any) => r.canal_conectado_id);

    let sharedData: any[] = [];
    if (sharedIds.length > 0) {
      const { data: sd } = await supabase
        .from("canais_conectados")
        .select("*")
        .in("id", sharedIds);
      sharedData = (sd as any) || [];
    }

    // merge unique
    const map = new Map<string, Conexao>();
    for (const c of [...((ownData as any) || []), ...sharedData]) map.set(c.id, c);
    const all = Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    setItems(all);

    // contar vínculos canal_contas para cada um
    if (all.length > 0) {
      const { data: vc } = await supabase
        .from("canal_contas")
        .select("canal_conectado_id, conta_filha_id, ativo")
        .in("canal_conectado_id", all.map((c) => c.id));
      const cnt: Record<string, number> = {};
      const owners: Record<string, string[]> = {};
      for (const r of (vc as any) || []) {
        if (!r.ativo) continue;
        cnt[r.canal_conectado_id] = (cnt[r.canal_conectado_id] || 0) + 1;
        (owners[r.canal_conectado_id] ||= []).push(r.conta_filha_id);
      }
      setVinculosCount(cnt);
      setVinculosOwners(owners);
    } else {
      setVinculosCount({});
      setVinculosOwners({});
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeContaId, isFilha, reloadKey]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  };

  const openEdit = (c: Conexao) => {
    const isShared = (vinculosCount[c.id] ?? 0) > 1 || c.empresa_id !== activeContaId;
    setEditing(c);
    const cfg = (c.configuracoes && typeof c.configuracoes === "object" ? c.configuracoes : {}) as Record<string, string>;
    setForm({
      tipo: c.tipo,
      nome: c.nome,
      nome_exibicao: c.nome_exibicao ?? "",
      identificador: c.identificador ?? "",
      provider: (c.provider ?? "outro") as Provider,
      ativo: c.ativo,
      uso: isShared ? "compartilhado" : "individual",
      status: (cfg._status as StatusConexao) || "preparacao",
      cfg,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!activeContaId || !isFilha) return;
    const nome = form.nome.trim();
    if (!nome) { toast.error("Informe o nome da conexão"); return; }

    setLoading(true);
    const identificador = identificadorPara(form);
    const configuracoes = {
      ...form.cfg,
      _status: form.status,
      _uso: form.uso,
    } as any;
    const payload = {
      empresa_id: activeContaId,
      tipo: form.tipo,
      nome,
      nome_exibicao: form.nome_exibicao.trim() || null,
      identificador: identificador || null,
      provider: form.provider,
      configuracoes,
      ativo: form.ativo,
    } as any;

    if (editing) {
      const { error } = await supabase
        .from("canais_conectados")
        .update({
          tipo: payload.tipo,
          nome: payload.nome,
          nome_exibicao: payload.nome_exibicao,
          identificador: payload.identificador,
          provider: payload.provider,
          configuracoes: payload.configuracoes,
          ativo: payload.ativo,
        })
        .eq("id", editing.id);
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Conexão atualizada");
    } else {
      // backend retorna a entidade criada diretamente no POST
      const { data, error } = await supabase
        .from("canais_conectados")
        .insert(payload);
      if (error) { setLoading(false); toast.error(error.message); return; }

      // vincular ao canal_contas (sempre vincula a conta filha ativa)
      await supabase.from("canal_contas").insert({
        canal_conectado_id: (data as any).id,
        conta_filha_id: activeContaId,
        ativo: true,
      });
      setLoading(false);
      toast.success("Conexão criada");
    }
    setOpen(false);
    setReloadKey((k) => k + 1);
  };

  const toggleAtivo = async (c: Conexao) => {
    const { error } = await supabase.from("canais_conectados").update({ ativo: !c.ativo }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    setReloadKey((k) => k + 1);
  };

  const canalLabel = (v: string) => CANAIS.find((c) => c.v === v)?.l ?? v;
  const providerLabel = (v: string | null) => PROVIDERS.find((p) => p.v === v)?.l ?? "—";

  const isShared = (c: Conexao) => (vinculosCount[c.id] ?? 0) > 1;
  const ownsCanal = (c: Conexao) => c.empresa_id === activeContaId;

  if (!activeConta) {
    return (
      <div className="p-6">
        <Alert>
          <AlertDescription>Selecione uma Conta Filha para gerenciar conexões.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!isFilha) {
    return (
      <div className="p-6">
        <Alert>
          <AlertDescription>Este módulo está disponível apenas para Contas Filhas.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Conexões</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os canais de atendimento conectados a esta conta.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Conta ativa: <span className="font-medium text-foreground">{activeConta.nome}</span>
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> Nova conexão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar conexão" : "Nova conexão"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome de exibição *</Label>
                <Input
                  value={form.nome_exibicao}
                  onChange={(e) => setForm({ ...form, nome_exibicao: e.target.value, nome: form.nome || e.target.value })}
                  maxLength={100}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo de canal</Label>
                  <Select
                    value={form.tipo}
                    onValueChange={(v) => {
                      const tipo = v as CanalTipo;
                      setForm({ ...form, tipo, provider: DEFAULT_PROVIDER[tipo], cfg: {} });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CANAIS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Provider</Label>
                  <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v as Provider, cfg: {} })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.filter((p) => PROVIDERS_BY_TIPO[form.tipo].includes(p.v)).map((p) => (
                        <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <CamposEspecificos form={form as any} setForm={setForm as any} />

              <div className="space-y-1.5">
                <Label>Uso</Label>
                <Select value={form.uso} onValueChange={(v) => setForm({ ...form, uso: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual (apenas esta conta)</SelectItem>
                    <SelectItem value="compartilhado">Compartilhado (várias contas)</SelectItem>
                  </SelectContent>
                </Select>
                {form.uso === "compartilhado" && (
                  <p className="text-xs text-muted-foreground">
                    Você poderá vincular outras Contas Filhas após criar a conexão, usando o painel "Contas vinculadas".
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Status da conexão</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as StatusConexao })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preparacao">Configuração em preparação</SelectItem>
                    <SelectItem value="conectado">Conectado</SelectItem>
                    <SelectItem value="erro">Erro de conexão</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Novas conexões iniciam como "Configuração em preparação". Esta etapa não conecta a API real.
                </p>
              </div>

              <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                Esta conexão ficará vinculada à Conta Filha ativa. Canais nunca são vinculados diretamente a Contas Gerentes.
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor="ativo">Ativo</Label>
                <Switch id="ativo" checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma conexão cadastrada nesta conta.</p>
            <Button onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> Criar primeira conexão
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Identificador</TableHead>
                <TableHead>Uso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-40 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => {
                const isOpen = !!expanded[c.id];
                const shared = isShared(c);
                const owner = ownsCanal(c);
                const count = vinculosCount[c.id] ?? 0;
                const isWaOficial = c.provider === "whatsapp_oficial";
                const isWaNaoOficial = c.provider === "whatsapp_nao_oficial";
                const isWebchat = c.tipo === "webchat";
                return (
                  <FragmentRow key={c.id}>
                    <TableRow>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => setExpanded((s) => ({ ...s, [c.id]: !s[c.id] }))}>
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{c.nome_exibicao || c.nome}</div>
                        {!owner && (
                          <div className="text-xs text-muted-foreground">Compartilhado de outra conta</div>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="outline">{canalLabel(c.tipo)}</Badge></TableCell>
                      <TableCell className="text-xs">
                        {providerLabel(c.provider)}
                        {isWaOficial && <Badge variant="secondary" className="ml-1 text-[10px]">Oficial</Badge>}
                        {isWaNaoOficial && <Badge variant="destructive" className="ml-1 text-[10px]">Não oficial</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{c.identificador || "—"}</TableCell>
                      <TableCell>
                        {shared ? (
                          <Badge variant="default" className="gap-1">
                            <Share2 className="h-3 w-3" /> Compartilhado · {count}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <User className="h-3 w-3" /> Individual
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={c.ativo ? "default" : "secondary"}>{c.ativo ? "Ativa" : "Inativa"}</Badge>
                          {(() => {
                            const s = ((c.configuracoes as any)?._status ?? "preparacao") as StatusConexao;
                            const variant = s === "conectado" ? "default" : s === "erro" ? "destructive" : "outline";
                            return <Badge variant={variant} className="text-[10px]">{STATUS_LABEL[s]}</Badge>;
                          })()}
                          {c.tipo === "whatsapp" && (() => {
                            const q = (c.configuracoes as any)?._quality as string | undefined;
                            if (!q) return null;
                            const qMap: Record<string, { label: string; cls: string }> = {
                              GREEN: { label: "🟢 Alta", cls: "border-emerald-500/40 text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/20" },
                              YELLOW: { label: "🟡 Média", cls: "border-amber-500/40 text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/20" },
                              RED: { label: "🔴 Baixa", cls: "border-destructive/40 text-destructive bg-destructive/5" },
                            };
                            const m = qMap[q.toUpperCase()];
                            if (!m) return null;
                            return (
                              <Badge variant="outline" className={`text-[10px] ${m.cls}`} title="Qualidade do número WhatsApp">
                                {m.label}
                              </Badge>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        {isWebchat && c.identificador && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={`/webchat/${c.identificador}`} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                        {owner && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => toggleAtivo(c)}>
                              {c.ativo ? "Desativar" : "Ativar"}
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={c.id + "-exp"}>
                        <TableCell colSpan={9} className="bg-muted/20">
                          <div className="space-y-3">
                            {isWaOficial && (
                              <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                  Mensagens fora da janela de 24h exigem template aprovado.
                                </AlertDescription>
                              </Alert>
                            )}
                            {isWaNaoOficial && (
                              <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                  Canal não oficial pode apresentar risco de estabilidade e conformidade.
                                </AlertDescription>
                              </Alert>
                            )}
                            {owner ? (
                              <CanalContasManager
                                canalId={c.id}
                                reloadKey={reloadKey}
                                onChanged={() => setReloadKey((k) => k + 1)}
                              />
                            ) : (
                              <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
                                Este canal pertence a outra Conta Filha. Apenas a conta proprietária pode editá-lo ou
                                gerenciar seus vínculos.
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </FragmentRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

type FormState = {
  tipo: CanalTipo;
  provider: Provider;
  cfg: Record<string, string>;
  [k: string]: any;
};

function CamposEspecificos({
  form,
  setForm,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
}) {
  const c = form.cfg || {};
  const set = (k: string, v: string) => setForm({ ...form, cfg: { ...c, [k]: v } });

  const Field = ({ k, label, placeholder, secret, readOnly, value }: {
    k?: string; label: string; placeholder?: string; secret?: boolean; readOnly?: boolean; value?: string;
  }) => (
    <div className="space-y-1.5">
      <Label>{label}{secret && <span className="ml-1 text-[10px] text-muted-foreground">(será salvo em cofre seguro)</span>}</Label>
      <Input
        type={secret ? "password" : "text"}
        value={value !== undefined ? value : (k ? c[k] || "" : "")}
        onChange={(e) => k && set(k, e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={readOnly ? "bg-muted/50" : ""}
        maxLength={400}
      />
    </div>
  );

  // WhatsApp Oficial
  if (form.tipo === "whatsapp" && form.provider === "whatsapp_oficial") {
    return (
      <div className="space-y-3">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Para WhatsApp Oficial, mensagens fora da janela de 24h exigem template aprovado.
          </AlertDescription>
        </Alert>
        <Field k="numero_exibido" label="Número WhatsApp exibido" placeholder="+55 11 99999-9999" />
        <div className="grid grid-cols-2 gap-3">
          <Field k="phone_number_id" label="Phone Number ID" placeholder="123456789012345" />
          <Field k="waba_id" label="WhatsApp Business Account ID" placeholder="987654321098765" />
        </div>
        <Field k="verify_token" label="Verify Token" placeholder="meu-verify-token" />
        <Field k="access_token" label="Token de acesso" secret placeholder="EAAG..." />
        <Field label="Webhook URL" readOnly value={`${window.location.origin}/webhooks/whatsapp`} />
      </div>
    );
  }

  // WhatsApp Não Oficial
  if (form.tipo === "whatsapp" && form.provider === "whatsapp_nao_oficial") {
    return (
      <div className="space-y-3">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Canal não oficial pode apresentar risco de estabilidade e conformidade.
          </AlertDescription>
        </Alert>
        <Field k="numero" label="Número WhatsApp" placeholder="+55 11 99999-9999" />
        <div className="grid grid-cols-2 gap-3">
          <Field k="provider_instancia" label="Provider / Instância" placeholder="evolution, z-api, etc." />
          <Field k="endpoint" label="URL / Base endpoint" placeholder="https://api.exemplo.com" />
        </div>
        <Field k="api_key" label="Token / Chave de API" secret />
        <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
          Status da sessão: <span className="font-medium">em preparação</span>
        </div>
      </div>
    );
  }

  // Webchat
  if (form.tipo === "webchat") {
    const slug = c.slug || "";
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          O Webchat gera um canal público para capturar conversas do site.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field k="slug" label="Slug do webchat" placeholder="meu-site" />
          <Field k="dominio" label="Domínio autorizado" placeholder="meusite.com.br" />
        </div>
        <div className="space-y-1.5">
          <Label>Script de instalação</Label>
          <Input
            readOnly
            className="bg-muted/50 font-mono text-xs"
            value={slug ? `<script src="${window.location.origin}/webchat/${slug}.js" async></script>` : "Gerado após salvar"}
          />
        </div>
      </div>
    );
  }

  // Instagram Direct
  if (form.tipo === "instagram") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Instagram Direct depende das permissões e webhooks da Meta.
        </p>
        <Field k="instagram_business_id" label="Instagram Business ID" />
        <div className="grid grid-cols-2 gap-3">
          <Field k="page_id" label="Página vinculada (Page ID)" />
          <Field k="app_id" label="App ID" />
        </div>
        <Field k="access_token" label="Token" secret />
        <Field label="Webhook URL" readOnly value={`${window.location.origin}/webhooks/instagram`} />
      </div>
    );
  }

  // Messenger / Facebook
  if (form.tipo === "messenger" || form.tipo === "facebook") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field k="page_id" label="Page ID" />
          <Field k="app_id" label="App ID" />
        </div>
        <Field k="page_access_token" label="Page Access Token" secret />
        <Field label="Webhook URL" readOnly value={`${window.location.origin}/webhooks/messenger`} />
      </div>
    );
  }

  // Telegram
  if (form.tipo === "telegram") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Telegram usa Bot API e pode receber mensagens via webhook.
        </p>
        <Field k="bot_username" label="Bot username" placeholder="@meubot" />
        <Field k="bot_token" label="Bot token" secret />
        <Field label="Webhook URL" readOnly value={`${window.location.origin}/webhooks/telegram`} />
      </div>
    );
  }

  // TikTok
  if (form.tipo === "tiktok") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          TikTok Business Messaging depende de acesso aprovado à API de mensagens.
        </p>
        <Field k="business_account_id" label="Business Account ID" />
        <Field k="app_id" label="App / Client ID" />
        <Field k="access_token" label="Token" secret />
        <Field label="Webhook URL" readOnly value={`${window.location.origin}/webhooks/tiktok`} />
      </div>
    );
  }

  // Email
  if (form.tipo === "email") {
    return (
      <div className="space-y-3">
        <Field k="email_remetente" label="E-mail remetente" placeholder="atendimento@empresa.com" />
        <div className="grid grid-cols-2 gap-3">
          <Field k="smtp_host" label="SMTP host" placeholder="smtp.exemplo.com" />
          <Field k="smtp_port" label="SMTP port" placeholder="587" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field k="smtp_user" label="SMTP usuário" />
          <Field k="smtp_password" label="SMTP senha" secret />
        </div>
      </div>
    );
  }

  return null;
}
