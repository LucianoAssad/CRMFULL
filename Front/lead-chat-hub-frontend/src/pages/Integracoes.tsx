import React, { useEffect, useState } from "react";
import { Plug, Plus, Copy, Check, RefreshCw, ExternalLink, Trash2, Zap, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Integracao {
  id: string; empresa_id: string; plataforma: string; nome: string;
  webhook_url: string | null; api_key: string | null; configuracao: string | null;
  status: string; ultimo_disparo: string | null; total_disparos: number; ativo: boolean;
}

const PLATAFORMAS = [
  {
    id: "zapier", nome: "Zapier", logo: "⚡", cor: "bg-orange-500",
    desc: "Conecte com +5.000 apps via Zapier. Use o webhook URL abaixo no seu Zap.",
    tipo: "webhook", docs: "https://zapier.com/apps/webhook/integrations",
  },
  {
    id: "make", nome: "Make (Integromat)", logo: "🔷", cor: "bg-purple-600",
    desc: "Automações visuais com Make. Configure o webhook URL no seu cenário.",
    tipo: "webhook", docs: "https://www.make.com/en/integrations/webhook",
  },
  {
    id: "rd_station", nome: "RD Station", logo: "🚀", cor: "bg-blue-600",
    desc: "Sincronize leads e eventos de conversão com o RD Station CRM.",
    tipo: "api_key", docs: "https://developers.rdstation.com/",
  },
  {
    id: "hubspot", nome: "HubSpot", logo: "🟠", cor: "bg-orange-600",
    desc: "Sincronize contatos e negócios com o HubSpot CRM.",
    tipo: "api_key", docs: "https://developers.hubspot.com/",
  },
  {
    id: "active_campaign", nome: "ActiveCampaign", logo: "📧", cor: "bg-blue-500",
    desc: "Sincronize contatos e automações de e-mail marketing.",
    tipo: "api_key", docs: "https://developers.activecampaign.com/",
  },
  {
    id: "pipedrive", nome: "Pipedrive", logo: "🎯", cor: "bg-green-600",
    desc: "Sincronize negócios e contatos com o Pipedrive.",
    tipo: "api_key", docs: "https://developers.pipedrive.com/",
  },
  {
    id: "n8n", nome: "n8n", logo: "🔄", cor: "bg-gray-700",
    desc: "Automações self-hosted com n8n. Use o webhook URL no seu workflow.",
    tipo: "webhook", docs: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/",
  },
  {
    id: "google_sheets", nome: "Google Sheets", logo: "📊", cor: "bg-green-500",
    desc: "Envie dados de leads e conversões para uma planilha Google.",
    tipo: "webhook", docs: "https://developers.google.com/sheets",
  },
];

export default function Integracoes() {
  const { activeContaId, scopedContaIds } = useActiveAccount();
  const ids = activeContaId ? [activeContaId] : scopedContaIds;

  const [integracoes, setIntegracoes] = useState<Integracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selPlat, setSelPlat] = useState<typeof PLATAFORMAS[0] | null>(null);
  const [editing, setEditing] = useState<Integracao | null>(null);
  const [form, setForm] = useState({ webhook_url: "", api_key: "", nome: "" });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const load = async () => {
    if (ids.length === 0) { setIntegracoes([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("integracoes_externas").select("*").in("empresa_id", ids).order("plataforma");
    setIntegracoes((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ids.join(",")]);

  const webhookBase = `${window.location.origin}/api/webhook`;
  const gerarWebhook = (plat: string) => `${webhookBase}/${plat}/${ids[0] || "empresa"}`;

  const openConfig = (plat: typeof PLATAFORMAS[0], existing?: Integracao) => {
    setSelPlat(plat);
    setEditing(existing || null);
    setForm({
      webhook_url: existing?.webhook_url || (plat.tipo === "webhook" ? gerarWebhook(plat.id) : ""),
      api_key: existing?.api_key || "",
      nome: existing?.nome || plat.nome,
    });
    setShowKey(false);
    setOpen(true);
  };

  const save = async () => {
    if (!selPlat || ids.length === 0) return;
    setSaving(true);
    const payload: any = {
      empresa_id: ids[0], plataforma: selPlat.id, nome: form.nome || selPlat.nome,
      webhook_url: form.webhook_url || null, api_key: form.api_key || null,
      ativo: true, status: "ativo", updated_at: new Date().toISOString(),
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("integracoes_externas").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("integracoes_externas").insert(payload));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Integração atualizada" : "Integração configurada!");
    setOpen(false); load();
  };

  const toggleAtivo = async (i: Integracao) => {
    await supabase.from("integracoes_externas").update({ ativo: !i.ativo, status: !i.ativo ? "ativo" : "inativo" } as any).eq("id", i.id);
    load();
  };

  const deleteInt = async (id: string) => {
    if (!confirm("Remover integração?")) return;
    await supabase.from("integracoes_externas").delete().eq("id", id);
    toast.success("Removida"); load();
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
    toast.success("Copiado!");
  };

  const intByPlat = (platId: string) => integracoes.find((i) => i.plataforma === platId);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Plug className="h-6 w-6" /> Integrações</h1>
          <p className="text-sm text-muted-foreground">Conecte o CRM com outras plataformas via webhook ou API</p>
        </div>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {/* Integrações ativas */}
      {integracoes.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Configuradas</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {integracoes.map((i) => {
              const meta = PLATAFORMAS.find((p) => p.id === i.plataforma);
              return (
                <Card key={i.id} className={cn(!i.ativo && "opacity-60")}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{meta?.logo || "🔌"}</span>
                        <div>
                          <CardTitle className="text-sm">{i.nome}</CardTitle>
                          <CardDescription className="text-xs">{i.total_disparos} disparos</CardDescription>
                        </div>
                      </div>
                      <Switch checked={i.ativo} onCheckedChange={() => toggleAtivo(i)} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Badge variant="outline" className={cn("text-[10px]", i.status === "ativo" ? "text-success border-success/40" : "")}>
                      {i.status}
                    </Badge>
                    {i.ultimo_disparo && (
                      <p className="text-[11px] text-muted-foreground">
                        Último: {new Date(i.ultimo_disparo).toLocaleString("pt-BR")}
                      </p>
                    )}
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={() => meta && openConfig(meta, i)}>
                        <Settings2 className="mr-1 h-3 w-3" /> Config
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => deleteInt(i.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Catálogo de plataformas */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Plataformas disponíveis</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PLATAFORMAS.map((plat) => {
            const configurada = intByPlat(plat.id);
            return (
              <Card key={plat.id} className={cn("cursor-pointer hover:border-primary/40 transition-colors", configurada && "border-primary/30 bg-primary/5")} onClick={() => openConfig(plat, configurada)}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{plat.logo}</span>
                      <span className="font-medium text-sm">{plat.nome}</span>
                    </div>
                    {configurada && <Badge className="text-[9px] px-1">Ativa</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{plat.desc}</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant={configurada ? "outline" : "default"} className="flex-1 h-7 text-xs" onClick={(e) => { e.stopPropagation(); openConfig(plat, configurada); }}>
                      {configurada ? "Configurar" : "Conectar"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7" asChild onClick={(e) => e.stopPropagation()}>
                      <a href={plat.docs} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Dialog configuração */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">{selPlat?.logo}</span> {selPlat?.nome}
            </DialogTitle>
          </DialogHeader>
          {selPlat && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{selPlat.desc}</p>

              {selPlat.tipo === "webhook" ? (
                <div className="space-y-2">
                  <Label>Webhook URL (gerado automaticamente)</Label>
                  <div className="flex gap-2">
                    <Input value={form.webhook_url} readOnly className="font-mono text-xs flex-1" />
                    <Button size="icon" variant="outline" onClick={() => copyText(form.webhook_url, "wh")}>
                      {copied === "wh" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Cole este URL no seu {selPlat.nome} como destino do webhook.
                    {" "}<a href={selPlat.docs} target="_blank" rel="noreferrer" className="underline">Ver docs →</a>
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>API Key / Token</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={form.api_key}
                      onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                      placeholder="Cole sua API key aqui..."
                      className="font-mono text-xs flex-1"
                    />
                    <Button size="icon" variant="ghost" onClick={() => setShowKey((s) => !s)}>
                      {showKey ? "🙈" : "👁"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Gere sua API key em: <a href={selPlat.docs} target="_blank" rel="noreferrer" className="underline">{selPlat.docs}</a>
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Nome (opcional)</Label>
                <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder={selPlat.nome} />
              </div>

              {/* Eventos que disparam */}
              <div className="rounded-md bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-medium">Eventos que serão enviados:</p>
                {["Novo lead criado", "Lead convertido", "Conversa aberta", "Venda fechada", "Oportunidade ganha/perdida"].map((e) => (
                  <p key={e} className="text-xs text-muted-foreground flex items-center gap-1">
                    <Zap className="h-3 w-3 text-primary" /> {e}
                  </p>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : editing ? "Atualizar" : "Ativar integração"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
